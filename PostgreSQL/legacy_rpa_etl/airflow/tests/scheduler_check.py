"""Real scheduler exercise on an internal Docker network; fictitious data only."""
import argparse
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import uuid

from cryptography import x509
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


def command(*args, input=None, timeout=90, check=True):
    result = subprocess.run(['docker', *args], input=input, capture_output=True,
                            text=True, encoding='utf-8', timeout=timeout)
    if check and result.returncode:
        raise RuntimeError('Disposable Docker command failed: ' + result.stderr[-1500:])
    return result


def certificates(folder, hostname):
    now = datetime.now(timezone.utc)
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'OLIUS disposable test CA')])
    ca = (x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name)
          .public_key(ca_key.public_key()).serial_number(x509.random_serial_number())
          .not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=1))
          .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
          .sign(ca_key, hashes.SHA256()))
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf = (x509.CertificateBuilder()
            .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, hostname)]))
            .issuer_name(ca_name).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=1))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName(hostname)]), critical=False)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .sign(ca_key, hashes.SHA256()))
    (folder / 'ca.pem').write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    (folder / 'server.crt').write_bytes(leaf.public_bytes(serialization.Encoding.PEM))
    (folder / 'server.key').write_bytes(key.private_bytes(serialization.Encoding.PEM,
                                                        serialization.PrivateFormat.PKCS8,
                                                        serialization.NoEncryption()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    if os.environ.get('OLIUS_ETL_DISPOSABLE') != '1':
        raise RuntimeError('Explicit disposable-only authorization required')
    repo = Path(args.repo).resolve()
    etl = repo / 'PostgreSQL/legacy_rpa_etl'
    if not (etl / 'airflow/dags/olius_legacy.py').is_file():
        raise ValueError('Repository root required')
    tag = uuid.uuid4().hex[:10]
    network, db, airflow, volume = ['olius-rpa-scheduler-' + item + '-' + tag
                                     for item in ('net', 'db', 'airflow', 'home')]
    label = 'org.olius.scheduler-test=' + tag
    created_containers = []
    created_network = created_volume = False
    password = secrets.token_hex(24)
    result_report = {'fixture_only': True, 'production_access': False}
    with tempfile.TemporaryDirectory(prefix='olius-scheduler-test-') as temporary:
        work = Path(temporary)
        secure = work / 'secrets'; secure.mkdir()
        outputs = {name: work / name for name in ('private', 'backup', 'reports')}
        for path in outputs.values():
            path.mkdir()
            path.chmod(0o770)
        certificates(secure, db)
        for name in ('credential_key', 'archive_key'):
            (secure / name).write_bytes(Fernet.generate_key())
        (secure / 'source_pgpass').write_text(f'{db}:5432:legacy_fixture:olius_legacy_reader:{password}\n')
        (secure / 'target_pgpass').write_text(f'{db}:5432:olius_target:etl_maintenance:{password}\n')

        def sql(database, text=None, file=None, check=True):
            arguments = ['exec', '-i', db, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
                         '-U', 'postgres', '-d', database, '-qAt']
            if file:
                arguments += ['-f', '/workspace/' + file]
            return command(*arguments, input=text, check=check).stdout.strip()

        def wait(predicate, seconds, description):
            deadline = time.monotonic() + seconds
            while time.monotonic() < deadline:
                try:
                    if predicate():
                        return
                except RuntimeError:
                    pass
                time.sleep(2)
            raise RuntimeError('Timeout: ' + description)

        try:
            command('network', 'create', '--internal', '--label', label, network)
            created_network = True
            command('volume', 'create', '--label', label, volume)
            created_volume = True
            command('run', '-d', '--name', db, '--label', label, '--network', network,
                    '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=airflow',
                    '--mount', f'type=bind,source={secure},target=/fixture,readonly',
                    '--mount', f'type=bind,source={repo},target=/workspace,readonly',
                    '--entrypoint', 'bash', 'postgres:16.15', '-ec',
                    'mkdir /tmp/ssl; cp /fixture/server.* /tmp/ssl/; chown -R postgres:postgres /tmp/ssl; '
                    'chmod 600 /tmp/ssl/server.key; exec docker-entrypoint.sh postgres '
                    '-c ssl=on -c ssl_cert_file=/tmp/ssl/server.crt -c ssl_key_file=/tmp/ssl/server.key')
            created_containers.append(db)
            wait(lambda: command('exec', db, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres',
                                 check=False).returncode == 0, 60, 'PostgreSQL startup')
            sql('airflow', f"CREATE ROLE airflow_meta LOGIN PASSWORD '{password}';\n"
                'ALTER DATABASE airflow OWNER TO airflow_meta;\n'
                'CREATE DATABASE olius_target;\nCREATE DATABASE legacy_fixture;')
            scripts = ['01_structure.sql','02_check_constraints.sql','03_indexes.sql',
                       '04_functions_procedures.sql','05_triggers.sql','06_ctes.sql',
                       '07_window_functions.sql','08_materialized_views.sql']
            for name in scripts:
                sql('olius_target', file='PostgreSQL/' + name)
            for name in ('01_structure.sql','02_check_constraints.sql','03_view.sql','04_load.sql'):
                sql('olius_target', file='PostgreSQL/data_catalog/' + name)
            sql('olius_target', file='PostgreSQL/access_control/01_roles.sql')
            sql('olius_target', file='PostgreSQL/legacy_rpa_etl/01_destination_control.sql')
            sql('olius_target', file='PostgreSQL/legacy_rpa_etl/02_extended_destination_control.sql')
            sql('olius_target', "INSERT INTO establishment_type(name) VALUES('Restaurante');")
            sql('olius_target', f"CREATE ROLE etl_maintenance LOGIN PASSWORD '{password}';\n"
                'GRANT olius_owner TO etl_maintenance; GRANT CONNECT ON DATABASE olius_target TO etl_maintenance;')
            # Same algorithm/shape as the legacy; never uses a real user's password/hash.
            salt = bytes(range(16))
            digest = hashlib.pbkdf2_hmac('sha256', b'fixture-only', salt, 120000, 32)
            encoded = 'pbkdf2$120000$' + base64.b64encode(salt).decode() + '$' + base64.b64encode(digest).decode()
            tables = ['ADM','ATUALIZACAO','B2B','CARTEIRA','CERTIFICADO','COLETA','ENDERECO',
                      'ENTREGA_PEV','MOTORISTA','MOVIMENTACAO_PONTOS','PEV','SOLICITACAO_COLETA']
            tables = [table for table in tables if table not in ('B2B', 'MOTORISTA', 'ENDERECO')]
            source_sql = '\n'.join(f'CREATE TABLE public."{table}"(id int PRIMARY KEY,nota text);' for table in tables)
            source_sql += '''
                CREATE TABLE public."USUARIO"("ID_usuario" int PRIMARY KEY,nome text,email text,
                    telefone text,primeiro_registro date,tipo_usuario text,senha text);
                CREATE TABLE public."B2C"("ID_B2C" int PRIMARY KEY,"ID_usuario" int,"CPF" text);
            '''
            source_sql += """
                CREATE TABLE public."B2B"("ID_B2B" int PRIMARY KEY,"CNPJ" text,"ID_endereco" int,
                    nome_empresa text,telefone text,"ID_usuario" int);
                INSERT INTO public."B2B" VALUES(1,'11222333000181',1,'Fixture business','11999999999',NULL);
                CREATE TABLE public."ENDERECO"("ID_endereco" int PRIMARY KEY,rua text,cidade text,bairro text,
                    cep text,numero text,complemento text,estado text);
                INSERT INTO public."ENDERECO" VALUES(1,'Fixture street','Fixture city','Fixture area','01001000','1',NULL,'SP');
                CREATE TABLE public."MOTORISTA"("ID_motorista" int PRIMARY KEY,nome text,status text);
                INSERT INTO public."MOTORISTA" VALUES(1,'Fixture driver','Ocupado');
            """
            (secure / 'b2b.csv').write_text('legacy_b2b_id;email;establishment_type;account_status;confirmed_by;confirmed_at\n'
                '1;fixture-business@example.invalid;Restaurante;ACTIVE;Fixture;2026-01-01\n', encoding='utf-8')
            (secure / 'drivers.csv').write_text('legacy_driver_id;cpf;cnh;account_status;confirmed_by;confirmed_at\n'
                '1;11144477735;01234567890;ACTIVE;Fixture;2026-01-01\n', encoding='utf-8')
            for ident, cpf in ((1, '52998224725'), (2, 'aesgcm$fixture-unavailable-key')):
                source_sql += f'''INSERT INTO public."USUARIO" VALUES({ident},'Scheduler fixture',
                    'scheduler-{ident}@example.invalid','11999999999','2025-01-01','B2C','{encoded}');
                    INSERT INTO public."B2C" VALUES({ident},{ident},'{cpf}');'''
            source_sql += f"CREATE ROLE olius_legacy_reader LOGIN PASSWORD '{password}';\n"
            source_sql += 'GRANT CONNECT ON DATABASE legacy_fixture TO olius_legacy_reader;\n'
            source_sql += 'GRANT USAGE ON SCHEMA public TO olius_legacy_reader;\n'
            source_sql += 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO olius_legacy_reader;'
            sql('legacy_fixture', source_sql)
            environment = {
                'AIRFLOW__DATABASE__SQL_ALCHEMY_CONN': f'postgresql+psycopg2://airflow_meta:{password}@{db}/airflow?sslmode=verify-full&sslrootcert=/run/secrets/ca.pem',
                'AIRFLOW__CORE__EXECUTOR': 'LocalExecutor', 'AIRFLOW__CORE__LOAD_EXAMPLES': 'false',
                'AIRFLOW__CORE__PARALLELISM': '2',
                'AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION': 'true',
                'AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS': 'fixture:admin',
                'AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE': '/opt/airflow/state/ui-passwords.json',
                'AIRFLOW__CORE__FERNET_KEY': Fernet.generate_key().decode(),
                'AIRFLOW__API_AUTH__JWT_SECRET': secrets.token_hex(32), 'AIRFLOW__API__WORKERS': '1',
                'PYTHONPATH': '/opt/olius', 'OLIUS_STAGE_PATH': '/opt/airflow/staging/legacy.sqlite',
                'OLIUS_ETL_STAGE_ROOT': '/opt/airflow/staging', 'OLIUS_ETL_KEY_ROOT': '/run/secrets',
                'OLIUS_ETL_COMPLEMENT_ROOT': '/run/secrets', 'OLIUS_LEGACY_HOST': db, 'OLIUS_LEGACY_PORT': '5432',
                'OLIUS_LEGACY_DATABASE': 'legacy_fixture', 'OLIUS_LEGACY_USER': 'olius_legacy_reader',
                'OLIUS_LEGACY_CA': '/run/secrets/ca.pem', 'OLIUS_ETL_LOAD_ENABLED': 'true',
                'OLIUS_TARGET_HOST': db, 'OLIUS_TARGET_PORT': '5432', 'OLIUS_TARGET_DATABASE': 'olius_target',
                'OLIUS_TARGET_USER': 'etl_maintenance', 'OLIUS_TARGET_CA': '/run/secrets/ca.pem',
                'OLIUS_TARGET_PGPASS': '/run/secrets/target_pgpass',
                'OLIUS_ETL_CONFIRMED_TARGET': f'{db}:5432/olius_target',
                'OLIUS_ETL_ARCHIVE_ENABLED': 'true', 'OLIUS_ETL_EXTENDED_LOAD_ENABLED': 'true',
                'OLIUS_B2B_COMPLEMENT_FILE': '/run/secrets/b2b.csv',
                'OLIUS_DRIVER_COMPLEMENT_FILE': '/run/secrets/drivers.csv'}
            arguments = ['run', '-d', '--name', airflow, '--label', label, '--network', network,
                         '--mount', f'type=volume,source={volume},target=/opt/airflow',
                         '--mount', f'type=bind,source={secure},target=/run/secrets,readonly',
                         '--mount', f'type=bind,source={etl / "airflow/dags"},target=/opt/airflow/dags,readonly']
            if hasattr(os, 'getgid'):
                arguments += ['--group-add', str(os.getgid())]
            for module in ('pipeline.py','credentials.py','loader.py','connections.py','archive.py','complements.py','extended.py','file_policy.py','stage_state.py'):
                arguments += ['--mount', f'type=bind,source={etl / module},target=/opt/olius/{module},readonly']
            for name, path in outputs.items():
                arguments += ['--mount', f'type=bind,source={path},target=/opt/olius-history/{name}']
            for name, value in environment.items():
                arguments += ['-e', name + '=' + value]
            arguments += ['olius-legacy-airflow:validation', 'bash', '-c',
                          'mkdir -p /opt/airflow/state /opt/airflow/staging && exec airflow standalone']
            command(*arguments)
            created_containers.append(airflow)
            wait(lambda: sql('airflow', "SELECT count(*) FROM dag WHERE dag_id='olius_legacy_preparation';", check=False) == '1',
                 180, 'DAG registration')
            command('exec', airflow, 'airflow', 'dags', 'unpause', 'olius_legacy_preparation')

            def run(run_id, expected, *, clear=False):
                result_report['active_scenario'] = run_id + ('-clear' if clear else '')
                if clear:
                    logical_date = sql('airflow', f"SELECT logical_date::text FROM dag_run WHERE run_id='{run_id}';")
                    command('exec', airflow, 'airflow', 'tasks', 'clear', '-y', '-s', logical_date,
                            '-e', logical_date, 'olius_legacy_preparation')
                else:
                    command('exec', airflow, 'airflow', 'dags', 'trigger', '--run-id', run_id,
                            '--logical-date', datetime.now(timezone.utc).isoformat(), 'olius_legacy_preparation')
                state_query = f"SELECT state FROM dag_run WHERE dag_id='olius_legacy_preparation' AND run_id='{run_id}';"
                wait(lambda: sql('airflow', state_query) in ('success', 'failed'), 300, 'scheduler run ' + run_id)
                state = sql('airflow', state_query)
                task_states = sql('airflow', f"SELECT task_id||':'||state FROM task_instance WHERE dag_id='olius_legacy_preparation' AND run_id='{run_id}' ORDER BY task_id;")
                if state != expected:
                    diagnostic = command('exec', airflow, 'python', '-c',
                        "import os,pipeline; s=pipeline.open_stage(os.environ['OLIUS_STAGE_PATH']); "
                        "rows=s.execute('SELECT id,status FROM runs').fetchall(); print(rows); "
                        "[pipeline.prepare(s,r[0]) for r in rows]", check=False)
                    raise RuntimeError('Unexpected DAG outcome: ' + state + ' / ' + task_states
                                       + '\nFixture diagnostic: ' + diagnostic.stdout[-1000:]
                                       + diagnostic.stderr[-1800:])
                return {'state': state, 'tasks': task_states.splitlines()}

            result_report['initial'] = run('scheduler-fixture-initial', 'success')
            assert sql('olius_target', 'SELECT count(*) FROM users;') == '2'
            result_report['cleared_initial'] = run('scheduler-fixture-initial', 'success', clear=True)
            assert sql('olius_target', 'SELECT count(*) FROM users;') == '2'
            sql('olius_target', "UPDATE users SET name='Edited fixture',password_hash='changed-fixture-hash';")
            result_report['repeat'] = run('scheduler-fixture-repeat', 'success')
            assert sql('olius_target', "SELECT count(*) FROM users WHERE name='Edited fixture' AND password_hash='changed-fixture-hash';") == '2'
            assert sql('olius_target', 'SELECT count(*) FROM olius_etl.citizen_import;') == '1'
            sql('legacy_fixture', f'''INSERT INTO public."USUARIO" VALUES(3,'New fixture',
                'scheduler-3@example.invalid','11999999999','2025-01-01','B2C','{encoded}');
                INSERT INTO public."B2C" VALUES(3,3,'11144477735');''')
            sql('olius_target', '''CREATE FUNCTION public.fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN IF NEW.email='scheduler-3@example.invalid' THEN RAISE EXCEPTION 'Fixture forced failure'; END IF;
                RETURN NEW; END $$;
                CREATE TRIGGER fixture_reject BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.fixture_reject();''')
            result_report['failure'] = run('scheduler-fixture-failure', 'failed')
            assert 'archive_history:success' in result_report['failure']['tasks']
            assert sql('olius_target', 'SELECT count(*) FROM users;') == '2'
            assert sql('olius_target', "SELECT count(*) FROM users_log WHERE email='scheduler-3@example.invalid';") == '0'
            sql('olius_target', 'DROP TRIGGER fixture_reject ON public.users; DROP FUNCTION public.fixture_reject();')
            result_report['recovery'] = run('scheduler-fixture-recovery', 'success')
            assert sql('olius_target', 'SELECT count(*) FROM users;') == '3'
            assert sql('olius_target', 'SELECT count(*) FROM olius_etl.citizen_import;') == '2'
            assert sql('olius_target', 'SELECT count(*) FROM olius_etl.establishment_import;') == '1'
            assert sql('olius_target', 'SELECT count(*) FROM olius_etl.driver_import;') == '1'
            assert sql('olius_target', 'SELECT count(*) FROM point_transaction;') == '0'
            assert sql('olius_target', 'SELECT count(*) FROM auth_session;') == '0'
            reports = list(outputs['reports'].glob('*.json'))
            assert len(reports) == 4
            for report in reports:
                text = report.read_text(encoding='utf-8')
                assert '@example.invalid' not in text and 'pbkdf2$' not in text and 'aesgcm$' not in text
                assert json.loads(text)['local_backup_verified'] is True
            checked = command('exec', airflow, 'python', '-c',
                "import os,json,pipeline; s=pipeline.open_stage(os.environ['OLIUS_STAGE_PATH']); "
                "rows=s.execute(\"SELECT status,reasons FROM candidates WHERE source_id='2'\").fetchall(); "
                "assert len(rows)==4 and all(status=='REJECTED' and 'CPF_DECRYPTION_KEY_REQUIRED' in json.loads(reasons) for status,reasons in rows); print('PASS')")
            assert checked.stdout.strip() == 'PASS'
            result_report.update(status='PASSED', shared_reports=len(reports), imported_citizens=2,
                                 imported_establishments=1, imported_drivers=1,
                                 cpf_without_key_rejected=True, backup_verified=True)
            report_path = Path(args.report).resolve()
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(result_report, indent=2), encoding='utf-8')
            print('PASS: real scheduler, TLS, partial rejection, transactional load, rerun, archival and failure propagation')
        finally:
            # Preserve aggregate diagnostics even when a timeout/assertion interrupts a scenario.
            result_report.setdefault('status', 'FAILED')
            report_path = Path(args.report).resolve()
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(result_report, indent=2), encoding='utf-8')
            for name in reversed(created_containers):
                inspection = command('inspect', name, check=False)
                if inspection.returncode == 0 and json.loads(inspection.stdout)[0]['Config']['Labels'].get('org.olius.scheduler-test') == tag:
                    command('rm', '-f', '-v', name)
            if created_volume:
                command('volume', 'rm', volume)
            if created_network:
                command('network', 'rm', network)


if __name__ == '__main__':
    main()
