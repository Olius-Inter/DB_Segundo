"""Atomic B2C loading with durable identity mapping; no historical points import."""
import hashlib
import json
import secrets
import uuid
from datetime import date

import psycopg2

from credentials import unseal


class ImportConflict(Exception):
    """Conflicting identity or changed source; never contains personal data."""


def fingerprint(payload, password_hash):
    # Includes the original hash so a later source credential change is a conflict,
    # but the password hash itself never goes into the provenance table.
    value = json.dumps([payload, password_hash], sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(value).digest()


def import_one(connection, source_system, run_id, payload, password_hash, after_insert=None):
    """Connection must be dedicated to the loader; each call is one transaction."""
    from credentials import valid_legacy
    if not valid_legacy(password_hash):
        raise ValueError('Unsupported legacy format')
    original_date = date.fromisoformat(payload['original_registration_date'])
    source_user = str(payload['legacy_user_id'])
    source_citizen = str(payload['legacy_citizen_id'])
    digest = fingerprint(payload, password_hash)
    with connection:
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout='10s'")
            cursor.execute("SET LOCAL statement_timeout='30s'")
            cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',
                           (json.dumps([source_system, source_user]),))
            cursor.execute('''SELECT source_citizen_id,destination_user_id,source_fingerprint
                FROM olius_etl.citizen_import WHERE source_system=%s AND source_user_id=%s''',
                           (source_system, source_user))
            previous = cursor.fetchone()
            if previous:
                if previous[0] != source_citizen or bytes(previous[2]) != digest:
                    raise ImportConflict('SOURCE_CHANGED')
                cursor.execute('''SELECT EXISTS(SELECT 1 FROM public.citizens c
                    JOIN public.users u ON u.id=c.id WHERE c.id=%s AND u.user_type='CITIZENS')''',
                               (previous[1],))
                if not cursor.fetchone()[0]:
                    raise ImportConflict('DESTINATION_INCOMPLETE')
                return 'ALREADY_IMPORTED', str(previous[1])
            cursor.execute('''SELECT EXISTS(SELECT 1 FROM public.users
                WHERE split_part(email,'@',1)=split_part(%s,'@',1)
                  AND lower(split_part(email,'@',2))=lower(split_part(%s,'@',2)))
                OR EXISTS(SELECT 1 FROM public.citizens WHERE cpf=%s)''',
                           (payload['email'], payload['email'], payload['cpf']))
            if cursor.fetchone()[0]:
                raise ImportConflict('IDENTITY_EXISTS')
            cursor.execute('''SELECT set_config('app.audit_actor','SYSTEM',true),
                set_config('app.current_user_id','',true),
                set_config('app.operational_driver_id','',true),
                set_config('app.audit_reason',%s,true)''',
                           ('Importação B2C legado; lote ' + run_id,))
            user_id = str(uuid.uuid4())
            qr_token = secrets.token_urlsafe(32)
            cursor.execute('''INSERT INTO public.users(id,name,email,password_hash,user_type)
                VALUES(%s,%s,%s,%s,'CITIZENS')''',
                           (user_id, payload['name'], payload['email'], password_hash))
            cursor.execute('''INSERT INTO public.telephone(telephone,user_id) VALUES(%s,%s)''',
                           (payload['telephone'], user_id))
            cursor.execute('''INSERT INTO public.user_qr_code(user_id,qr_token,user_type)
                VALUES(%s,%s,'CITIZENS')''', (user_id, qr_token))
            cursor.execute('INSERT INTO public.citizens(id,cpf,qr_token) VALUES(%s,%s,%s)',
                           (user_id, payload['cpf'], qr_token))
            if after_insert:
                after_insert(cursor)  # Failure injection in disposable integration tests only.
            cursor.execute('''INSERT INTO olius_etl.citizen_import(source_system,source_user_id,
                source_citizen_id,destination_user_id,source_fingerprint,
                original_registration_date,first_run_id) VALUES(%s,%s,%s,%s,%s,%s,%s)''',
                           (source_system, source_user, source_citizen, user_id, digest,
                            original_date, run_id))
            return 'IMPORTED', user_id


def load(stage, run_id, key, connect, *, enabled=False):
    if not enabled:
        raise ValueError('Destination loading disabled')
    run = stage.execute('SELECT source,status FROM runs WHERE id=?', (run_id,)).fetchone()
    if not run or run[1] != 'PREPARED':
        raise ValueError('Prepare the snapshot before loading')
    if stage.execute("SELECT count(*) FROM candidates WHERE run_id=? AND status='BLOCKED_POLICY'",
                     (run_id,)).fetchone()[0]:
        raise ValueError('Snapshot requires protected credentials and approved policies')
    rows = stage.execute("SELECT source_id,payload FROM candidates WHERE run_id=? AND status='READY'",
                         (run_id,)).fetchall()
    connection = connect()
    try:
        connection.autocommit = False
        info = connection.get_dsn_parameters()
        target = json.dumps([info.get('host'), info.get('port'), info.get('dbname')])
        if stage.execute('SELECT 1 FROM load_results WHERE run_id=? AND target<>? LIMIT 1',
                         (run_id, target)).fetchone():
            raise ValueError('This run already targets a different destination')
        for source_id, raw in rows:
            payload = json.loads(raw)
            secret = stage.execute('''SELECT ciphertext FROM sealed_credentials
                WHERE run_id=? AND user_id=?''', (run_id, str(payload['legacy_user_id']))).fetchone()
            if not secret:
                raise ValueError('Protected credential missing')
            password_hash = unseal(key, run_id, payload['legacy_user_id'], secret[0])
            try:
                status, destination_id = import_one(connection, run[0], run_id, payload, password_hash)
            except ImportConflict:
                status, destination_id = 'CONFLICT', None
            except psycopg2.IntegrityError:
                # A concurrent identity collision is a conflict, not a reason to overwrite.
                # Other integrity failures are not silently classified as business rejection.
                raise
            with stage:
                stage.execute('''INSERT INTO load_results VALUES(?,?,?,?,?)
                    ON CONFLICT(run_id,source_id) DO UPDATE SET status=excluded.status,
                    destination_id=excluded.destination_id,target=excluded.target''',
                              (run_id, source_id, status, destination_id,
                               target))
    finally:
        connection.close()


def reconcile(stage, run_id, connect):
    """Verify durable mapping and structural links, not mutable profile values/hashes."""
    source = stage.execute('SELECT source FROM runs WHERE id=?', (run_id,)).fetchone()
    if not source:
        raise ValueError('Unknown snapshot')
    expected = stage.execute("SELECT count(*) FROM candidates WHERE run_id=? AND status='READY'",
                             (run_id,)).fetchone()[0]
    completed = stage.execute('''SELECT count(*) FROM load_results
        WHERE run_id=? AND status IN ('IMPORTED','ALREADY_IMPORTED')''', (run_id,)).fetchone()[0]
    if expected != completed:
        raise ValueError('Unresolved or missing load results')
    connection = connect()
    try:
        connection.set_session(readonly=True)
        for raw, destination_id in stage.execute('''SELECT c.payload,r.destination_id
            FROM candidates c JOIN load_results r USING(run_id,source_id)
            WHERE c.run_id=? AND r.status IN ('IMPORTED','ALREADY_IMPORTED')''', (run_id,)):
            payload = json.loads(raw)
            with connection.cursor() as cursor:
                cursor.execute('''SELECT EXISTS(SELECT 1 FROM olius_etl.citizen_import m
                    JOIN public.users u ON u.id=m.destination_user_id
                    JOIN public.citizens c ON c.id=u.id
                    JOIN public.user_qr_code q ON q.user_id=c.id AND q.qr_token=c.qr_token
                    WHERE m.source_system=%s AND m.source_user_id=%s AND u.id=%s
                      AND u.user_type='CITIZENS')''',
                               (source[0], str(payload['legacy_user_id']), destination_id))
                if not cursor.fetchone()[0]:
                    raise ValueError('Destination reconciliation failed')
    finally:
        connection.rollback()
        connection.close()
