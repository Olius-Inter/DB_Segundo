"""Legacy extraction, sealed credentials, and opt-in atomic B2C migration."""
import argparse
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

TABLES = ('ADM', 'ATUALIZACAO', 'B2B', 'B2C', 'CARTEIRA', 'CERTIFICADO',
          'COLETA', 'ENDERECO', 'ENTREGA_PEV', 'MOTORISTA',
          'MOVIMENTACAO_PONTOS', 'PEV', 'SOLICITACAO_COLETA', 'USUARIO')


def open_stage(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.execute('PRAGMA foreign_keys=ON')
    connection.executescript('''
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY, started_at TEXT NOT NULL,
            source TEXT NOT NULL, status TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS raw_rows (
            run_id TEXT NOT NULL REFERENCES runs(id), source_table TEXT NOT NULL,
            source_id TEXT NOT NULL, payload TEXT NOT NULL,
            PRIMARY KEY(run_id, source_table, source_id));
        CREATE TABLE IF NOT EXISTS candidates (
            run_id TEXT NOT NULL REFERENCES runs(id), source_id TEXT NOT NULL,
            status TEXT NOT NULL, reasons TEXT NOT NULL, payload TEXT NOT NULL,
            PRIMARY KEY(run_id, source_id));
        CREATE TABLE IF NOT EXISTS sealed_credentials (
            run_id TEXT NOT NULL REFERENCES runs(id), user_id TEXT NOT NULL,
            ciphertext BLOB NOT NULL, PRIMARY KEY(run_id,user_id));
        CREATE TABLE IF NOT EXISTS credential_batches (
            run_id TEXT PRIMARY KEY REFERENCES runs(id));
        CREATE TABLE IF NOT EXISTS load_results (
            run_id TEXT NOT NULL REFERENCES runs(id), source_id TEXT NOT NULL,
            status TEXT NOT NULL, destination_id TEXT, target TEXT NOT NULL,
            PRIMARY KEY(run_id,source_id));
    ''')
    return connection


def extract(stage, source_name, connect, run_id=None, credential_key=None):
    """Commit one complete snapshot to SQLite, or leave no partial raw snapshot."""
    run_id = run_id or str(uuid.uuid4())
    previous = stage.execute('SELECT source,status FROM runs WHERE id=?', (run_id,)).fetchone()
    if previous:
        if previous[0] != source_name:
            raise ValueError('Run already belongs to another source')
        if previous[1] in ('EXTRACTED', 'PREPARED'):
            if credential_key and not stage.execute(
                    'SELECT 1 FROM credential_batches WHERE run_id=?', (run_id,)).fetchone():
                raise ValueError('Use a new run to extract protected credentials')
            return run_id
        with stage:
            stage.execute('DELETE FROM candidates WHERE run_id=?', (run_id,))
            stage.execute('DELETE FROM sealed_credentials WHERE run_id=?', (run_id,))
            stage.execute('DELETE FROM credential_batches WHERE run_id=?', (run_id,))
            stage.execute('DELETE FROM load_results WHERE run_id=?', (run_id,))
            stage.execute('DELETE FROM raw_rows WHERE run_id=?', (run_id,))
            stage.execute("UPDATE runs SET status='EXTRACTING' WHERE id=?", (run_id,))
    else:
        stage.execute('INSERT INTO runs VALUES (?,?,?,?)',
                      (run_id, datetime.now(timezone.utc).isoformat(), source_name, 'EXTRACTING'))
    stage.commit()
    source = None
    try:
        from psycopg2 import sql
        source = connect()
        source.set_session(isolation_level='REPEATABLE READ', readonly=True)
        with source.cursor() as cursor:
            cursor.execute("SELECT current_setting('transaction_read_only')")
            if cursor.fetchone()[0] != 'on':
                raise RuntimeError('Source must be read-only')
            for table in TABLES:
                cursor.execute('''SELECT column_name FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=%s
                    ORDER BY ordinal_position''', (table,))
                # Credential values never leave PostgreSQL. Raw means original
                # selected values, not a full backup of secret columns.
                columns = [row[0] for row in cursor.fetchall() if row[0].lower() != 'senha']
                cursor.execute('''SELECT a.attname FROM pg_constraint c
                    JOIN pg_class t ON t.oid=c.conrelid
                    JOIN pg_namespace n ON n.oid=t.relnamespace
                    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(c.conkey)
                    WHERE c.contype='p' AND n.nspname='public' AND t.relname=%s''', (table,))
                keys = [row[0] for row in cursor.fetchall()]
                if len(keys) != 1 or keys[0] not in columns:
                    raise RuntimeError('Unexpected legacy primary key')
                cursor.execute(sql.SQL('SELECT {} FROM public.{}').format(
                    sql.SQL(',').join(map(sql.Identifier, columns)), sql.Identifier(table)))
                while True:
                    rows = cursor.fetchmany(500)
                    if not rows:
                        break
                    for values in rows:
                        payload = dict(zip(columns, values))
                        stage.execute('INSERT INTO raw_rows VALUES (?,?,?,?)',
                                      (run_id, table, str(payload[keys[0]]),
                                       json.dumps(payload, ensure_ascii=False, default=str)))
            if credential_key:
                from credentials import store_credentials
                store_credentials(stage, cursor, run_id, credential_key)
                stage.execute('INSERT INTO credential_batches VALUES (?)', (run_id,))
        stage.execute("UPDATE runs SET status='EXTRACTED' WHERE id=?", (run_id,))
        stage.commit()
        return run_id
    except Exception:
        stage.rollback()
        stage.execute("UPDATE runs SET status='FAILED' WHERE id=?", (run_id,))
        stage.commit()
        raise
    finally:
        if source is not None:
            source.rollback()
            source.close()


def prepare(stage, run_id):
    run = stage.execute('SELECT status FROM runs WHERE id=?', (run_id,)).fetchone()
    if not run or run[0] not in ('EXTRACTED', 'PREPARED'):
        raise ValueError('Run must contain a complete extraction')
    def records(table):
        return [json.loads(row[0]) for row in stage.execute(
            'SELECT payload FROM raw_rows WHERE run_id=? AND source_table=?', (run_id, table))]
    users = {row['ID_usuario']: row for row in records('USUARIO')}
    citizens = records('B2C')
    cpfs = [row['CPF'] for row in citizens]
    owners = [row['ID_usuario'] for row in citizens]
    email_keys = [(str(row['email']).split('@')[0], str(row['email']).split('@')[-1].lower())
                  for row in users.values()]
    with stage:
        if stage.execute('SELECT 1 FROM load_results WHERE run_id=? LIMIT 1', (run_id,)).fetchone():
            raise ValueError('Cannot prepare an already attempted load; use load to resume')
        stage.execute('DELETE FROM candidates WHERE run_id=?', (run_id,))
        for citizen in citizens:
            reasons = []
            user = users.get(citizen['ID_usuario'])
            cpf = str(citizen['CPF'])
            if not (cpf.isascii() and cpf.isdigit() and len(cpf) == 11):
                reasons.append('INVALID_CPF_FORMAT')
            if cpfs.count(citizen['CPF']) > 1 or owners.count(citizen['ID_usuario']) > 1:
                reasons.append('DUPLICATE_IDENTITY')
            if not user:
                reasons.append('MISSING_USER')
            else:
                email = str(user['email'])
                phone = ''.join(char for char in str(user['telefone']) if char in '0123456789')
                if user['tipo_usuario'] != 'B2C':
                    reasons.append('PROFILE_MISMATCH')
                if not str(user['nome']).strip() or len(user['nome']) > 150:
                    reasons.append('INVALID_NAME')
                if email.count('@') != 1 or any(char.isspace() for char in email) or len(email) > 255:
                    reasons.append('INVALID_EMAIL')
                elif not all(email.split('@')):
                    reasons.append('INVALID_EMAIL')
                elif email_keys.count((email.split('@')[0], email.split('@')[1].lower())) > 1:
                    reasons.append('DUPLICATE_EMAIL')
                if not 10 <= len(phone) <= 15:
                    reasons.append('INVALID_PHONE')
                try:
                    from datetime import date
                    if date.fromisoformat(user['primeiro_registro']) > date.today():
                        reasons.append('INVALID_REGISTRATION_DATE')
                except (ValueError, TypeError):
                    reasons.append('INVALID_REGISTRATION_DATE')
            payload = {'legacy_citizen_id': citizen['ID_B2C'],
                       'legacy_user_id': citizen['ID_usuario']}
            if user:
                payload.update(name=user['nome'], email=user['email'], cpf=cpf,
                               telephone=phone, user_type='CITIZENS',
                               original_registration_date=user['primeiro_registro'])
            protected = stage.execute('''SELECT 1 FROM sealed_credentials
                WHERE run_id=? AND user_id=?''', (run_id, str(citizen['ID_usuario']))).fetchone()
            if not protected and stage.execute('SELECT 1 FROM credential_batches WHERE run_id=?',
                                              (run_id,)).fetchone():
                reasons.append('UNSUPPORTED_OR_MISSING_LEGACY_CREDENTIAL')
            status = 'REJECTED' if reasons else ('READY' if protected else 'BLOCKED_POLICY')
            if not reasons and not protected:
                reasons = ['PROTECTED_LEGACY_CREDENTIAL_REQUIRED']
            stage.execute('INSERT INTO candidates VALUES (?,?,?,?,?)',
                          (run_id, str(citizen['ID_B2C']), status,
                           json.dumps(reasons), json.dumps(payload, ensure_ascii=False)))
        stage.execute("UPDATE runs SET status='PREPARED' WHERE id=?", (run_id,))


def report(stage, run_id):
    run = stage.execute('SELECT status FROM runs WHERE id=?', (run_id,)).fetchone()
    if not run:
        raise ValueError('Unknown run')
    loaded = dict(stage.execute('''SELECT status,count(*) FROM load_results
        WHERE run_id=? GROUP BY status''', (run_id,)))
    return {'run_id': run_id, 'status': run[0], 'destination_writes': loaded.get('IMPORTED', 0),
            'load_counts': loaded,
            'source_counts': dict(stage.execute('''SELECT source_table,count(*)
                FROM raw_rows WHERE run_id=? GROUP BY source_table''', (run_id,))),
            'candidate_counts': dict(stage.execute('''SELECT status,count(*)
                FROM candidates WHERE run_id=? GROUP BY status''', (run_id,)))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('step', choices=('extract', 'prepare', 'report', 'load', 'reconcile'))
    parser.add_argument('--stage', required=True)
    parser.add_argument('--run-id')
    parser.add_argument('--credential-key-file')
    args = parser.parse_args()
    stage = open_stage(args.stage)
    try:
        if args.step == 'extract':
            import psycopg2
            # Explicit host/database/user/CA avoid silently using a default target.
            connection = {key: os.environ['OLIUS_LEGACY_' + env] for key, env in
                          [('host', 'HOST'), ('port', 'PORT'), ('dbname', 'DATABASE'),
                           ('user', 'USER'), ('sslrootcert', 'CA')]}
            connection.update(sslmode='verify-full', connect_timeout=15,
                              options='-c default_transaction_read_only=on -c statement_timeout=60000',
                              application_name='olius_legacy_etl')
            run_id = extract(stage, connection['host'] + ':' + connection['port'] + '/' + connection['dbname'],
                             lambda: psycopg2.connect(**connection),
                             credential_key=Path(args.credential_key_file).read_bytes().strip()
                             if args.credential_key_file else None)
        else:
            if not args.run_id:
                parser.error('--run-id is required for prepare/report')
            run_id = args.run_id
            if args.step == 'prepare':
                prepare(stage, run_id)
            elif args.step in ('load', 'reconcile'):
                from loader import load, reconcile
                from connections import destination_connection
                if args.step == 'load':
                    if not args.credential_key_file:
                        raise ValueError('Protected credential key required')
                    load(stage, run_id, Path(args.credential_key_file).read_bytes().strip(),
                         destination_connection, enabled=os.environ.get('OLIUS_ETL_LOAD_ENABLED') == 'true')
                else:
                    reconcile(stage, run_id, destination_connection)
        print(json.dumps(report(stage, run_id), indent=2))
    except Exception as exc:
        # Exception text from drivers may contain connection details or data.
        print(json.dumps({'status': 'FAILED', 'error_type': type(exc).__name__}))
        raise SystemExit(1) from None
    finally:
        stage.close()


if __name__ == '__main__':
    main()
