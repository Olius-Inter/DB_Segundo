"""Explicit disposable PostgreSQL integration test. Never uses Aiven or .env."""
import concurrent.futures
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import uuid

import psycopg2
from cryptography.fernet import Fernet

from credentials import seal
from loader import ImportConflict, import_one, load, reconcile
from pipeline import TABLES, extract, open_stage, prepare
from test_credentials import fake_hash


ROOT = Path(__file__).resolve().parents[2]


def main():
    if os.environ.get('OLIUS_ETL_DISPOSABLE') != '1':
        raise RuntimeError('Set OLIUS_ETL_DISPOSABLE=1 for an isolated Docker test only')
    name = 'olius-etl-test-' + uuid.uuid4().hex[:10]
    password = secrets.token_hex(24)
    created = False

    def docker(*args, input=None):
        result = subprocess.run(['docker', *args], input=input, text=True, encoding='utf-8',
                                capture_output=True, timeout=180)
        if result.returncode:
            raise RuntimeError('Disposable Docker operation failed: ' + result.stderr[-1800:])
        return result.stdout

    try:
        docker('run', '-d', '--name', name, '--label', 'org.olius.purpose=etl-disposable',
               '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=olius_test',
               '-p', '127.0.0.1::5432', '--mount', f'type=bind,source={ROOT},target=/workspace,readonly',
               'postgres:16.15')
        created = True
        for attempt in range(60):
            state = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1',
                                    '-U', 'postgres'], capture_output=True)
            if state.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('Disposable PostgreSQL not ready')
        paths = [f'PostgreSQL/{f}' for f in ['01_structure.sql','02_check_constraints.sql',
                 '03_indexes.sql','04_functions_procedures.sql','05_triggers.sql',
                 '06_ctes.sql','07_window_functions.sql','08_materialized_views.sql']]
        paths += ['PostgreSQL/data_catalog/' + f for f in
                  ['01_structure.sql','02_check_constraints.sql','03_view.sql','04_load.sql']]
        paths += ['PostgreSQL/access_control/01_roles.sql',
                  'PostgreSQL/legacy_rpa_etl/01_destination_control.sql',
                  'PostgreSQL/legacy_rpa_etl/02_extended_destination_control.sql']
        for path in paths:
            docker('exec', name, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres',
                   '-d', 'olius_test', '-f', '/workspace/' + path)
        port = json.loads(docker('inspect', name))[0]['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort']
        def connect():
            return psycopg2.connect(host='127.0.0.1', port=port, dbname='olius_test',
                                    user='postgres', password=password)
        admin = connect()
        with admin:
            with admin.cursor() as q:
                q.execute('CREATE ROLE etl_test_operator LOGIN PASSWORD %s', (password,))
                q.execute('GRANT olius_owner TO etl_test_operator')
                q.execute('GRANT CONNECT ON DATABASE olius_test TO etl_test_operator')
        admin.close()
        def operator_connect():
            return psycopg2.connect(host='127.0.0.1', port=port, dbname='olius_test',
                                    user='etl_test_operator', password=password)
        payload = dict(legacy_user_id=1, legacy_citizen_id=1, name='ETL fixture',
                       email='etl-fixture@example.invalid', cpf='52998224725',
                       telephone='11999999999', user_type='CITIZENS', original_registration_date='2025-01-01')
        run_id = str(uuid.uuid4())
        value = fake_hash()
        c = operator_connect()
        status, uid = import_one(c, 'fixture', run_id, payload, value)
        assert status == 'IMPORTED'
        assert import_one(c, 'fixture', str(uuid.uuid4()), payload, value) == ('ALREADY_IMPORTED', uid)
        with c:
            with c.cursor() as q:
                q.execute("UPDATE public.users SET name='Edited in app',password_hash='new-format-fixture' WHERE id=%s", (uid,))
        assert import_one(c, 'fixture', run_id, payload, value)[0] == 'ALREADY_IMPORTED'
        with c.cursor() as q:
            q.execute('SELECT name,password_hash,status FROM users WHERE id=%s', (uid,))
            assert q.fetchone() == ('Edited in app', 'new-format-fixture', 'ACTIVE')
        c.rollback()
        try:
            import_one(c, 'fixture', run_id, dict(payload, name='Changed source'), value)
            raise AssertionError('Changed source was overwritten')
        except ImportConflict:
            pass
        try:
            import_one(c, 'fixture', run_id, dict(payload, legacy_user_id=88, legacy_citizen_id=88), value)
            raise AssertionError('Existing app identity was merged')
        except ImportConflict:
            pass
        broken = dict(payload, legacy_user_id=2, legacy_citizen_id=2,
                      email='rollback@example.invalid', cpf='12345678902')
        def fail(cursor):
            cursor.execute('SELECT 1/0')
        try:
            import_one(c, 'fixture', run_id, broken, value, after_insert=fail)
            raise AssertionError('Failure injection did not fail')
        except psycopg2.Error:
            pass
        with c.cursor() as q:
            q.execute('SELECT count(*) FROM users WHERE email=%s', (broken['email'],))
            assert q.fetchone()[0] == 0
            q.execute('SELECT count(*) FROM users_log WHERE email=%s', (broken['email'],))
            assert q.fetchone()[0] == 0
        c.rollback(); c.close()
        race = dict(broken, legacy_user_id=3, legacy_citizen_id=3,
                    email='race@example.invalid', cpf='12345678903')
        def race_load(_):
            connection = operator_connect()
            try:
                return import_one(connection, 'fixture', run_id, race, value)[0]
            finally:
                connection.close()
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            assert sorted(pool.map(race_load, range(2))) == ['ALREADY_IMPORTED', 'IMPORTED']
        with tempfile.TemporaryDirectory() as folder:
            stage = open_stage(Path(folder) / 'stage.sqlite')
            try:
                stage.execute('INSERT INTO runs VALUES(?,?,?,?)', (run_id, '2026-11-03', 'fixture', 'EXTRACTED'))
                user = dict(ID_usuario=1, nome=payload['name'], email=payload['email'],
                            telefone=payload['telephone'], primeiro_registro='2025-01-01', tipo_usuario='B2C')
                for table, record in [('USUARIO', user), ('B2C', dict(ID_B2C=1, ID_usuario=1, CPF=payload['cpf']))]:
                    stage.execute('INSERT INTO raw_rows VALUES(?,?,?,?)', (run_id, table, '1', json.dumps(record)))
                key = Fernet.generate_key()
                stage.execute('INSERT INTO sealed_credentials VALUES(?,?,?)', (run_id, '1', seal(key, run_id, 1, value)))
                stage.commit(); prepare(stage, run_id)
                load(stage, run_id, key, operator_connect, enabled=True)
                reconcile(stage, run_id, operator_connect)
            finally:
                stage.close()
        # Exercise the actual extractor against a separate disposable legacy DB.
        admin = connect(); admin.autocommit = True
        with admin.cursor() as q:
            q.execute('CREATE DATABASE legacy_fixture')
        admin.close()
        source_admin = psycopg2.connect(host='127.0.0.1', port=port, dbname='legacy_fixture',
                                        user='postgres', password=password)
        from psycopg2 import sql
        with source_admin:
            with source_admin.cursor() as q:
                for table in TABLES:
                    if table not in ('USUARIO', 'B2C'):
                        q.execute(sql.SQL('CREATE TABLE public.{}(id int PRIMARY KEY,senha text)').format(sql.Identifier(table)))
                q.execute('''CREATE TABLE public."USUARIO"("ID_usuario" int PRIMARY KEY,
                    nome text,email text,telefone text,primeiro_registro date,tipo_usuario text,senha text)''')
                q.execute('''CREATE TABLE public."B2C"("ID_B2C" int PRIMARY KEY,"ID_usuario" int,"CPF" text)''')
                q.execute('''INSERT INTO public."USUARIO" VALUES(7,'Extracted fixture',
                    'extracted@example.invalid','11999999999','2025-02-01','B2C',%s)''', (value,))
                q.execute('INSERT INTO public."B2C" VALUES(7,7,\'11144477735\')')
                q.execute('INSERT INTO public."ADM" VALUES(1,%s)', (value,))
                q.execute('CREATE ROLE etl_test_reader LOGIN PASSWORD %s', (password,))
                q.execute('GRANT CONNECT ON DATABASE legacy_fixture TO etl_test_reader')
                q.execute('GRANT USAGE ON SCHEMA public TO etl_test_reader')
                q.execute('GRANT SELECT ON ALL TABLES IN SCHEMA public TO etl_test_reader')
        source_admin.close()
        def source_connect():
            return psycopg2.connect(host='127.0.0.1', port=port, dbname='legacy_fixture',
                                    user='etl_test_reader', password=password)
        with tempfile.TemporaryDirectory() as folder:
            stage = open_stage(Path(folder) / 'stage.sqlite')
            try:
                key = Fernet.generate_key()
                batch = extract(stage, 'fixture-extract', source_connect, credential_key=key)
                assert stage.execute('SELECT count(*) FROM sealed_credentials').fetchone()[0] == 1
                assert value not in '\n'.join(stage.iterdump())
                prepare(stage, batch)
                load(stage, batch, key, operator_connect, enabled=True)
                reconcile(stage, batch, operator_connect)
                load(stage, batch, key, operator_connect, enabled=True)
                assert stage.execute('SELECT status FROM load_results').fetchone()[0] == 'ALREADY_IMPORTED'
            finally:
                stage.close()
        from test_extended import exercise_destination
        exercise_destination(operator_connect)
        print('PASS: B2B and driver load, password preservation, reconciliation, conflicts and rollback')
        print('PASS: insert, rerun, app changes, source conflict, rollback with audit, concurrent rerun, sealed load and reconciliation')
        print('PASS: real read-only extraction, encrypted B2C-only credential transport, non-superuser destination, end-to-end repeat')
    finally:
        if created:
            # Remove only the uniquely named, owned test container verified by its label.
            info = json.loads(docker('inspect', name))[0]
            if info['Config']['Labels'].get('org.olius.purpose') == 'etl-disposable':
                docker('rm', '-f', '-v', name)


if __name__ == '__main__':
    main()
