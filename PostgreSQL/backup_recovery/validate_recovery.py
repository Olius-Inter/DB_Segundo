"""Laboratório local PostgreSQL 16.15; stdlib, sem conexão de produção.

Cria dois clusters novos, somente loopback, sem apagar diretórios preexistentes.
O superusuário inicia o laboratório e cria o administrador restrito; toda a
instalação, exportação e recuperação usa recovery_admin NOSUPERUSER.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GROUPS = ['olius_owner', 'olius_reader', 'olius_auditor', 'olius_catalog_editor',
          'olius_api', 'olius_ranking_reader', 'olius_auth_owner', 'olius_business_owner',
          'olius_dm_owner', 'olius_bi_reader_role', 'olius_bi_refresh_role']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', required=True, type=Path)
    parser.add_argument('--port', type=int, default=55486)
    args = parser.parse_args()
    report = HERE / 'artifacts'
    report.mkdir(exist_ok=True)
    lab = Path(tempfile.mkdtemp(prefix='olius-recovery-'))
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env.update(PGCLIENTENCODING='UTF8', PGCONNECT_TIMEOUT='5')
    transcript = []
    results = {}
    started = []

    def run(tool, *params, sql=None, expected=0):
        command = [str(args.pg_bin / (tool + ('.exe' if os.name == 'nt' else ''))), *map(str, params)]
        print('$ ' + subprocess.list2cmdline(command), flush=True)
        # pg_ctl no Windows pode deixar handles de pipes herdados no servidor.
        # Arquivos temporários evitam aguardar EOF de um postmaster já iniciado.
        with tempfile.TemporaryFile(mode='w+', encoding='utf-8', errors='replace') as out, \
             tempfile.TemporaryFile(mode='w+', encoding='utf-8', errors='replace') as err:
            result = subprocess.run(command, input=sql, stdout=out, stderr=err, text=True,
                                    encoding='utf-8', errors='replace', env=env, timeout=180)
            out.seek(0)
            err.seek(0)
            result.stdout, result.stderr = out.read(), err.read()
        transcript.append('$ ' + subprocess.list2cmdline(command) + '\n' +
                          (sql or '') + '\n' + result.stdout + result.stderr +
                          f'\nexit={result.returncode}\n')
        if (expected == 0 and result.returncode != 0) or (expected != 0 and result.returncode == 0):
            raise RuntimeError(transcript[-1][-5000:])
        return result.stdout.strip(), result.stderr

    def psql(port, database, sql=None, files=(), user='recovery_admin', extra=(), expected=0):
        params = ['-X', '-w', '-h', '127.0.0.1', '-p', port, '-U', user,
                  '-d', database, '-v', 'ON_ERROR_STOP=1', '-At', *extra]
        for path in files:
            params += ['-f', str(path)]
        return run('psql', *params, sql=sql, expected=expected)

    def snapshot(port, database):
        # Todos os registros, inclusive logs; ordem física e OIDs não importam.
        tables = psql(port, database, "SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) "
                      "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                      "WHERE n.nspname IN ('public','dm') AND c.relkind IN ('r','m') ORDER BY 1;")[0].splitlines()
        data = {}
        queries = [f"SELECT '{table}',coalesce(json_agg(row_to_json(t) ORDER BY row_to_json(t)::text),'[]'::json)::text FROM {table} t;"
                   for table in tables]
        rows = psql(port, database, '\n'.join(queries))[0]
        for row in rows.splitlines():
            table, value = row.split('|', 1)
            data[table] = hashlib.sha256(value.encode()).hexdigest()
        schema = report / (database + '-schema.sql')
        run('pg_dump', '-h', '127.0.0.1', '-p', port, '-U', 'recovery_admin', '-w',
            '-d', database, '--schema-only', '--file', schema)
        lines = [line for line in schema.read_text(encoding='utf-8').splitlines()
                 if not line.startswith(('\\restrict ', '\\unrestrict ', '--'))]
        # ACLs têm ordem de inserção diferente após GRANT/REVOKE temporários.
        grants = sorted(line for line in lines if line.startswith(('GRANT ', 'REVOKE ')))
        body = [line for line in lines if not line.startswith(('GRANT ', 'REVOKE '))]
        # O parser de PG16 achata AND associativo ao reler esta constraint.
        # Normalizar SOMENTE essa grafia conhecida; não remover parênteses gerais.
        body = [line.replace(
            'CHECK ((((anchor_day >= 1) AND (anchor_day <= 31)) AND ',
            'CHECK (((anchor_day >= 1) AND (anchor_day <= 31) AND ')
            if 'CONSTRAINT ck_subscription_cycle_anchor CHECK' in line else line for line in body]
        normalized = '\n'.join(body + grants)
        counts = psql(port, database, "SELECT "
            "(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace),"
            "(SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal),"
            "(SELECT count(*) FROM pg_views WHERE schemaname IN ('public','dm'));")[0]
        database_acl = psql(port, database, "SELECT pg_get_userbyid(a.grantor),"
            "CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,"
            "a.privilege_type,a.is_grantable FROM pg_database d,"
            "LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a "
            "WHERE d.datname=current_database() ORDER BY 1,2,3,4;")[0]
        return {'tables': data, 'schema_sha256': hashlib.sha256(normalized.encode()).hexdigest(),
                'routines_triggers_views': counts, 'database_acl': database_acl}

    try:
        results['client_version'] = run('pg_dump', '--version')[0]
        for offset in (0, 1):
            data = lab / f'cluster{offset}'
            run('initdb', '-D', data, '-U', 'lab_super', '--auth=trust', '--encoding=UTF8', '--locale=C')
            # Trust restrito ao loopback, apenas dentro do laboratório descartável.
            run('pg_ctl', '-D', data, '-l', lab / f'cluster{offset}.log', '-w', 'start',
                '-o', f'-h 127.0.0.1 -p {args.port + offset}')
            started.append(data)
            psql(args.port + offset, 'postgres',
                 'CREATE ROLE recovery_admin LOGIN INHERIT NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;',
                 user='lab_super')
            psql(args.port + offset, 'postgres', files=[HERE / 'provision_roles.sql'])
        source, target = 'olius_backup_source', 'olius_backup_recovered'
        for port, database in ((args.port, source), (args.port + 1, target)):
            psql(port, 'postgres', f'CREATE DATABASE {database} WITH TEMPLATE template0;')
            version = psql(port, database, 'SHOW server_version;')[0]
            if version != '16.15':
                raise RuntimeError(f'Exige PostgreSQL 16.15; encontrado {version}')
            results[database + '_admin'] = psql(port, database,
                "SELECT current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user;")[0]
            results['server_version'] = version
        scripts = ['01_structure.sql','02_check_constraints.sql','03_indexes.sql',
                   '04_functions_procedures.sql','05_triggers.sql','06_ctes.sql',
                   '07_window_functions.sql','08_materialized_views.sql']
        scripts += ['data_catalog/' + s for s in ['01_structure.sql','02_check_constraints.sql','03_view.sql','04_load.sql']]
        scripts += ['access_control/01_roles.sql','access_control/02_users.sql']
        for script in scripts:
            psql(args.port, source, files=[ROOT / 'PostgreSQL' / script])
        # Fixtures artificiais persistentes, para o dump conter dados reais de teste.
        psql(args.port, source, files=[ROOT / 'PostgreSQL/tests/fixtures_procedures.sql'])
        psql(args.port, source, 'DROP SCHEMA olius_test CASCADE;')
        # pg_dump reconstitui materializadas com REFRESH, não copia tuplas antigas.
        psql(args.port, source, 'BEGIN ISOLATION LEVEL REPEATABLE READ; CALL dm.refresh_data_mart(); COMMIT;')
        # O schema de helpers não integra o backup; dados e logs artificiais ficam.
        dump = report / 'backup-lab.sql'
        run('pg_dump', '-h', '127.0.0.1', '-p', args.port, '-U', 'recovery_admin',
            '-w', '-d', source, '--format=plain', '--file', dump)
        # Contas são globais, ausentes do dump. Provisionar antes quando ACLs as citam.
        # O 02_users depende de objetos: aplicado somente DEPOIS da restauração.
        _, error = psql(args.port + 1, target, files=[dump],
                        extra=['--single-transaction'], expected=1)
        if 'permission denied for schema public' not in error:
            raise RuntimeError('Controle negativo não reproduziu falha de ownership: ' + error)
        remaining = psql(args.port + 1, target,
            "SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m');")[0]
        if remaining != '0':
            raise RuntimeError('A tentativa negativa deixou objetos no destino')
        results['negative_without_temporary_create'] = 'PASS: permission denied for schema public; rollback'
        psql(args.port + 1, target,
             files=[HERE / 'prepare_restore.sql', dump, HERE / 'finish_restore.sql'],
             extra=['--single-transaction', '-v', f'source_database={source}'])
        psql(args.port + 1, target, files=[ROOT / 'PostgreSQL/access_control/02_users.sql'])
        a, b = snapshot(args.port, source), snapshot(args.port + 1, target)
        (report / 'source-inventory.json').write_text(json.dumps(a, indent=2), encoding='utf-8')
        (report / 'target-inventory.json').write_text(json.dumps(b, indent=2), encoding='utf-8')
        if a != b:
            raise RuntimeError('Inventário divergente: comparar source/target-inventory.json e *-schema.sql')
        results['full_data_and_schema_comparison'] = f'PASS: {len(a["tables"])} tabelas/views materializadas; SHA256 de todos os registros e DDL/owners/ACLs iguais'
        results['routines_triggers_views'] = a['routines_triggers_views']
        # Mesmo servidor: reaproveita os papéis globais já existentes.
        same = 'olius_backup_same_server'
        psql(args.port, 'postgres', f'CREATE DATABASE {same} WITH TEMPLATE template0;')
        psql(args.port, same, files=[HERE / 'prepare_restore.sql', dump, HERE / 'finish_restore.sql'],
             extra=['--single-transaction', '-v', f'source_database={source}'])
        psql(args.port, same, files=[ROOT / 'PostgreSQL/access_control/02_users.sql'])
        if snapshot(args.port, same) != a:
            raise RuntimeError('Inventário divergente no mesmo servidor')
        results['same_server_restore'] = 'PASS: dados, DDL e ACLs iguais à origem'
        # Login efetivo da Core, sem SET ROLE a partir de superusuário.
        psql(args.port + 1, target, "BEGIN; SELECT current_user,session_user; "
             "INSERT INTO public.users(name,email,password_hash,user_type) "
             "VALUES ('Recovery smoke','recovery-smoke@olius.test','hash-apenas-teste','CITIZENS'); "
             "SELECT count(*) FROM public.users WHERE email='recovery-smoke@olius.test'; COMMIT;",
             user='olius_core_api')
        count = psql(args.port + 1, target,
            "SELECT count(*) FROM public.users_log WHERE email='recovery-smoke@olius.test';")[0]
        if count != '1':
            raise RuntimeError('Auditoria da gravação Core não confirmada: ' + count)
        results['core_login_insert_and_audit_trigger'] = 'PASS: login olius_core_api, INSERT autorizado e log gerado'
        auth = psql(args.port + 1, target,
             "SELECT result_code FROM public.open_auth_session((SELECT id FROM public.users WHERE email='recovery-smoke@olius.test'),"
             "decode(repeat('ab',32),'hex'));", user='olius_core_api')[0]
        if auth != 'OK':
            raise RuntimeError('Autenticação recuperada não retornou OK: ' + auth)
        results['core_auth_security_definer'] = 'PASS: open_auth_session executada como olius_core_api'
        _, error = psql(args.port + 1, target, 'CREATE TABLE public.forbidden(id int);', user='olius_core_api', expected=1)
        if 'permission denied' not in error:
            raise RuntimeError(error)
        results['core_forbidden_ddl'] = 'PASS: CREATE TABLE negado'
        results['internal_create_revoked'] = psql(args.port + 1, target,
            "SELECT rolname,has_schema_privilege(rolname,'public','CREATE') FROM pg_roles "
            "WHERE rolname IN ('olius_auth_owner','olius_business_owner') ORDER BY 1;")[0]
        if '|t' in results['internal_create_revoked']:
            raise RuntimeError('CREATE temporário não foi revogado')
        results['status'] = 'PASS'
    except Exception as exc:
        results['status'] = 'FAIL'
        results['error'] = str(exc)
        raise
    finally:
        for data in reversed(started):
            try:
                run('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')
            except Exception as exc:
                results.setdefault('cleanup_errors', []).append(str(exc))
        results['lab_directory'] = str(lab)
        (report / 'commands.log').write_text('\n'.join(transcript), encoding='utf-8')
        (report / 'results.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
        print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
