"""Opt-in preparation and atomic loading of complemented B2Bs and drivers."""
import argparse
import json
import os
import re
import secrets
import uuid
from collections import Counter

from psycopg2 import sql
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id

from complements import read_records, validate_records
from loader import ImportConflict, fingerprint
from pipeline import open_stage
from stage_state import frozen, bind_target, invalidate, confirm, require_extended

MAPPINGS = {'b2b': ('B2B', 'ID_B2B', 'establishment_import', 'establishment'),
            'driver': ('MOTORISTA', 'ID_motorista', 'driver_import', 'driver')}


def password_without_known_owner():
    """Core-compatible Argon2id; neither password nor hash is logged/staged.

    Python cannot guarantee erasure of all temporary memory copies. This is not
    protection against a compromised process. No fixed prefix or shared password.
    """
    return Argon2id(salt=os.urandom(16), length=32, iterations=2, lanes=1,
                    memory_cost=19456).derive_phc_encoded(secrets.token_bytes(32))


def raw_records(stage, run_id, table):
    return {source_id: json.loads(payload) for source_id, payload in stage.execute(
        'SELECT source_id,payload FROM raw_rows WHERE run_id=? AND source_table=?', (run_id, table))}


def text(value):
    return '' if value is None else str(value).strip()


def digits(value):
    return ''.join(char for char in text(value) if char in '0123456789')


def prepare_extended(stage, run_id, kind, path):
    table, _, _, _ = MAPPINGS[kind]
    if stage.execute('SELECT status FROM runs WHERE id=?', (run_id,)).fetchone() != ('PREPARED',):
        raise ValueError('Prepare the original snapshot first')
    if frozen(stage, run_id):
        raise ValueError('Cannot change complements after any load attempt')
    source = raw_records(stage, run_id, table)
    rows = read_records(path, kind)
    summary = validate_records(rows, kind, set(source))
    if summary['rejected_rows']:
        raise ValueError('Correct complement file before preparation')
    complements = {row['legacy_b2b_id' if kind == 'b2b' else 'legacy_driver_id']: row for row in rows}
    addresses = raw_records(stage, run_id, 'ENDERECO') if kind == 'b2b' else {}
    prepared = [prepare_record(kind, identity, record, complements.get(identity), addresses)
                for identity, record in source.items()]
    # Source identity collisions must not be discovered only after partially loading the batch.
    identity_field = 'cnpj' if kind == 'b2b' else 'cpf'
    duplicates = Counter(item[2].get(identity_field) for item in prepared if not item[1])
    with stage:
        if frozen(stage, run_id):
            raise ValueError('Cannot change a frozen preparation')
        stage.execute('DELETE FROM extended_candidates WHERE run_id=? AND kind=?', (run_id, kind))
        for identity, reasons, payload in prepared:
            if payload.get(identity_field) and duplicates[payload[identity_field]] > 1:
                reasons.append('DUPLICATE_SOURCE_DOCUMENT')
            stage.execute('INSERT INTO extended_candidates VALUES(?,?,?,?,?,?)',
                          (run_id, kind, identity, 'REJECTED' if reasons else 'READY',
                           json.dumps(reasons), json.dumps(payload, ensure_ascii=False)))
        stage.execute('INSERT OR IGNORE INTO extended_preparations VALUES(?,?)', (run_id, kind))
    return extended_report(stage, run_id, kind)


def prepare_record(kind, identity, record, complement, addresses):
    reasons, payload = [], {'source_id': identity}
    if complement is None:
        return [identity, ['COMPLEMENT_REQUIRED'], payload]
    payload.update(complement=complement, status=complement['account_status'],
                   name=text(record.get('nome_empresa' if kind == 'b2b' else 'nome')))
    if not payload['name'] or len(payload['name']) > 150:
        reasons.append('INVALID_NAME')
    if kind == 'driver':
        payload.update(cpf=complement['cpf'], cnh=complement['cnh'])
    else:
        prepare_establishment(record, complement, addresses, payload, reasons)
    return [identity, reasons, payload]


def prepare_establishment(record, complement, addresses, payload, reasons):
    # Linked accounts need an identity/credential review, never a second account.
    if record.get('ID_usuario') is not None:
        reasons.append('LINKED_LEGACY_ACCOUNT_REQUIRES_REVIEW')
    payload.update(email=complement['email'], category=complement['establishment_type'],
                   cnpj=digits(record.get('CNPJ')), telephone=digits(record.get('telefone')))
    if not re.fullmatch(r'(?:[0-9]{14}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2})', text(record.get('CNPJ'))):
        reasons.append('INVALID_CNPJ_FORMAT')
    if not 10 <= len(payload['telephone']) <= 15:
        reasons.append('INVALID_PHONE')
    address = addresses.get(str(record.get('ID_endereco')))
    if address is None:
        reasons.append('ADDRESS_REQUIRED')
        return
    mapped = dict(state=text(address.get('estado')).upper(), city=text(address.get('cidade')),
                  neighborhood=text(address.get('bairro')), street=text(address.get('rua')),
                  number=text(address.get('numero')), cep=digits(address.get('cep')),
                  complement=text(address.get('complemento')) or None)
    limits = {'city': 100, 'neighborhood': 100, 'street': 150, 'number': 20}
    if (not mapped['state'].isascii() or not mapped['state'].isalpha()
            or len(mapped['state']) != 2 or len(mapped['cep']) != 8
            or any(not mapped[key] or len(mapped[key]) > limit for key, limit in limits.items())
            or len(mapped['complement'] or '') > 150):
        reasons.append('INVALID_ADDRESS')
    payload['address'] = mapped
    payload['legacy_address_id'] = str(record['ID_endereco'])


def extended_report(stage, run_id, kind):
    counts = dict(stage.execute('SELECT status,count(*) FROM extended_candidates '
                                'WHERE run_id=? AND kind=? GROUP BY status', (run_id, kind)))
    return dict(kind=kind, candidate_counts=counts, load_counts=dict(stage.execute(
        'SELECT status,count(*) FROM extended_results WHERE run_id=? AND kind=? GROUP BY status',
        (run_id, kind))))


def import_extended(connection, source, run_id, kind, payload, after_insert=None):
    _, _, mapping, _ = MAPPINGS[kind]
    digest = fingerprint(payload, None)  # Random bootstrap credentials never affect re-execution.
    with connection:
        with connection.cursor() as q:
            q.execute("SET LOCAL lock_timeout='10s'")
            q.execute("SET LOCAL statement_timeout='30s'")
            q.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',
                      (json.dumps([source, kind, payload['source_id']]),))
            q.execute(sql.SQL('SELECT destination_id,source_fingerprint FROM olius_etl.{} '
                              'WHERE source_system=%s AND source_id=%s').format(sql.Identifier(mapping)),
                      (source, payload['source_id']))
            previous = q.fetchone()
            if previous:
                if bytes(previous[1]) != digest:
                    raise ImportConflict('SOURCE_CHANGED')
                verify_destination(q, source, kind, payload['source_id'], previous[0])
                return 'ALREADY_IMPORTED', str(previous[0])
            q.execute("SELECT set_config('app.audit_actor','SYSTEM',true),"
                      "set_config('app.current_user_id','',true),"
                      "set_config('app.operational_driver_id','',true),"
                      "set_config('app.audit_reason',%s,true)", ('Importação legado ' + kind + '; lote ' + run_id,))
            destination = str(uuid.uuid4())
            if kind == 'driver':
                q.execute('SELECT EXISTS(SELECT 1 FROM public.driver WHERE cpf=%s OR cnh=%s)',
                          (payload['cpf'], payload['cnh']))
                if q.fetchone()[0]:
                    raise ImportConflict('IDENTITY_EXISTS')
                q.execute('INSERT INTO public.driver(id,name,cpf,cnh,status) VALUES(%s,%s,%s,%s,%s)',
                          (destination, payload['name'], payload['cpf'], payload['cnh'], payload['status']))
            else:
                insert_establishment(q, destination, payload)
            if after_insert:
                after_insert(q)
            q.execute(sql.SQL('INSERT INTO olius_etl.{}(source_system,source_id,destination_id,'
                              'source_fingerprint,first_run_id) VALUES(%s,%s,%s,%s,%s)').format(sql.Identifier(mapping)),
                      (source, payload['source_id'], destination, digest, run_id))
            return 'IMPORTED', destination


def insert_establishment(q, destination, payload):
    q.execute("SELECT EXISTS(SELECT 1 FROM public.users WHERE split_part(email,'@',1)=split_part(%s,'@',1) "
              "AND lower(split_part(email,'@',2))=lower(split_part(%s,'@',2))) "
              'OR EXISTS(SELECT 1 FROM public.establishment WHERE cnpj=%s)',
              (payload['email'], payload['email'], payload['cnpj']))
    if q.fetchone()[0]:
        raise ImportConflict('IDENTITY_EXISTS')
    q.execute('SELECT id FROM public.establishment_type WHERE name=%s', (payload['category'],))
    category = q.fetchone()
    if category is None:
        raise ImportConflict('OFFICIAL_CATEGORY_NOT_FOUND')
    address_id, qr = str(uuid.uuid4()), secrets.token_urlsafe(32)
    address = payload['address']
    q.execute("INSERT INTO public.addresses(id,owner_kind,state,city,neighborhood,street,number,cep,complement) "
              "VALUES(%s,'ESTABLISHMENT',%s,%s,%s,%s,%s,%s,%s)",
              (address_id,) + tuple(address[key] for key in
                                   ('state', 'city', 'neighborhood', 'street', 'number', 'cep', 'complement')))
    q.execute("INSERT INTO public.users(id,name,email,password_hash,user_type,status) "
              "VALUES(%s,%s,%s,%s,'ESTABLISHMENT',%s)",
              (destination, payload['name'], payload['email'], password_without_known_owner(), payload['status']))
    q.execute('INSERT INTO public.telephone(telephone,user_id) VALUES(%s,%s)', (payload['telephone'], destination))
    q.execute("INSERT INTO public.user_qr_code(user_id,qr_token,user_type) VALUES(%s,%s,'ESTABLISHMENT')",
              (destination, qr))
    q.execute('INSERT INTO public.establishment(id,cnpj,qr_token,type_id,address_id) VALUES(%s,%s,%s,%s,%s)',
              (destination, payload['cnpj'], qr, category[0], address_id))


def verify_destination(q, source, kind, source_id, destination):
    if kind == 'b2b':
        q.execute('SELECT EXISTS(SELECT 1 FROM olius_etl.establishment_import m '
                  'JOIN public.establishment e ON e.id=m.destination_id '
                  "JOIN public.users u ON u.id=e.id AND u.user_type='ESTABLISHMENT' "
                  'JOIN public.user_qr_code r ON r.user_id=e.id AND r.qr_token=e.qr_token '
                  'JOIN public.addresses a ON a.id=e.address_id AND a.owner_kind=e.address_kind '
                  'WHERE m.source_system=%s AND m.source_id=%s AND m.destination_id=%s)',
                  (source, source_id, destination))
    else:
        q.execute('SELECT EXISTS(SELECT 1 FROM olius_etl.driver_import m '
                  'JOIN public.driver d ON d.id=m.destination_id '
                  'WHERE m.source_system=%s AND m.source_id=%s AND m.destination_id=%s)',
                  (source, source_id, destination))
    if not q.fetchone()[0]:
        raise ImportConflict('DESTINATION_INCOMPLETE')


def run_extended(stage, run_id, connect, *, enabled=False, reconcile_only=False):
    if not enabled:
        raise ValueError('Extended loading disabled')
    run = stage.execute('SELECT source,status FROM runs WHERE id=?', (run_id,)).fetchone()
    if not run or run[1] != 'PREPARED':
        raise ValueError('Prepared snapshot required')
    require_extended(stage, run_id)
    invalidate(stage, run_id, 'extended')
    connection = connect()
    try:
        target = bind_target(stage, run_id, connection)
        for kind, identity, raw in stage.execute("SELECT kind,source_id,payload FROM extended_candidates "
                                               "WHERE run_id=? AND status='READY'", (run_id,)).fetchall():
            payload = json.loads(raw)
            if reconcile_only:
                result = stage.execute('SELECT destination_id,status FROM extended_results '
                                       'WHERE run_id=? AND kind=? AND source_id=?', (run_id, kind, identity)).fetchone()
                if not result or result[1] not in ('IMPORTED', 'ALREADY_IMPORTED'):
                    raise ValueError('Unresolved extended load')
                with connection:
                    with connection.cursor() as q:
                        q.execute('SET TRANSACTION READ ONLY')
                        verify_destination(q, run[0], kind, identity, result[0])
            else:
                try:
                    status, destination = import_extended(connection, run[0], run_id, kind, payload)
                except ImportConflict:
                    status, destination = 'CONFLICT', None
                with stage:
                    stage.execute('INSERT INTO extended_results VALUES(?,?,?,?,?,?) '
                                  'ON CONFLICT(run_id,kind,source_id) DO UPDATE SET status=excluded.status,'
                                  'destination_id=excluded.destination_id,target=excluded.target',
                                  (run_id, kind, identity, status, destination, target))
        if reconcile_only:
            confirm(stage, run_id, 'extended', target)
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('step', choices=('prepare', 'load', 'reconcile', 'report'))
    parser.add_argument('--stage', required=True)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--kind', choices=tuple(MAPPINGS))
    parser.add_argument('--file')
    args = parser.parse_args()
    stage = None
    try:
        stage = open_stage(args.stage)
        if args.step == 'prepare':
            if not args.kind or not args.file:
                raise ValueError('Kind and private complement file required')
            prepare_extended(stage, args.run_id, args.kind, args.file)
        elif args.step in ('load', 'reconcile'):
            from connections import destination_connection
            run_extended(stage, args.run_id, destination_connection,
                         enabled=os.environ.get('OLIUS_ETL_EXTENDED_LOAD_ENABLED') == 'true',
                         reconcile_only=args.step == 'reconcile')
        print(json.dumps([extended_report(stage, args.run_id, kind) for kind in MAPPINGS]))
    except Exception as exc:
        print(json.dumps(dict(status='FAILED', error_type=type(exc).__name__)))
        return 1
    finally:
        if stage is not None:
            stage.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
