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

def report_directory(ci_reports):
    """Seleciona apenas destinos fixos e rejeita redirecionamento por symlink."""
    relative = 'coverage/backup-recovery/artifacts' if ci_reports else 'PostgreSQL/backup_recovery/artifacts'
    directory = ROOT / relative
    if directory.resolve() != directory:
        raise ValueError('Diretório de relatórios não pode ser redirecionado por link')
    return directory

def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', required=True, type=Path)
    parser.add_argument('--port', type=int, default=55486)
    parser.add_argument('--ci-reports', action='store_true', help='Usar a pasta fixa coverage/backup-recovery/artifacts')
    return parser.parse_args(argv)

class RecoveryValidation:
    """Coordena o laboratório e separa cada etapa verificável da recuperação."""

    def __init__(self, args):
        self.args = args
        self.report = report_directory(args.ci_reports)
        self.report.mkdir(parents=True, exist_ok=True)
        self.lab = Path(tempfile.mkdtemp(prefix='olius-recovery-'))
        self.env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        self.env.update(PGCLIENTENCODING='UTF8', PGCONNECT_TIMEOUT='5')
        self.transcript = []
        self.results = {}
        self.started = []
        self.source = 'olius_backup_source'
        self.target = 'olius_backup_recovered'

    def run(self, tool, *params, sql=None, expected=0):
        command = [str(self.args.pg_bin / (tool + ('.exe' if os.name == 'nt' else ''))), *map(str, params)]
        print('$ ' + subprocess.list2cmdline(command), flush=True)
        # Arquivos temporários evitam esperar EOF de handles herdados pelo pg_ctl no Windows.
        with tempfile.TemporaryFile(mode='w+', encoding='utf-8', errors='replace') as out, tempfile.TemporaryFile(mode='w+', encoding='utf-8', errors='replace') as err:
            result = subprocess.run(command, input=sql, stdout=out, stderr=err, text=True, encoding='utf-8', errors='replace', env=self.env, timeout=180)
            out.seek(0)
            err.seek(0)
            result.stdout, result.stderr = (out.read(), err.read())
        self.transcript.append('$ ' + subprocess.list2cmdline(command) + '\n' + (sql or '') + '\n' + result.stdout + result.stderr + f'\nexit={result.returncode}\n')
        if expected == 0 and result.returncode != 0 or (expected != 0 and result.returncode == 0):
            raise RuntimeError(self.transcript[-1][-5000:])
        return (result.stdout.strip(), result.stderr)

    def psql(self, port, database, sql=None, files=(), user='recovery_admin', extra=(), expected=0):
        params = ['-X', '-w', '-h', '127.0.0.1', '-p', port, '-U', user, '-d', database, '-v', 'ON_ERROR_STOP=1', '-At', *extra]
        for path in files:
            params += ['-f', str(path)]
        return self.run('psql', *params, sql=sql, expected=expected)

    def snapshot(self, port, database):
        tables = self.psql(port, database, "SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','dm') AND c.relkind IN ('r','m') ORDER BY 1;")[0].splitlines()
        data = {}
        queries = [f"SELECT '{table}',coalesce(json_agg(row_to_json(t) ORDER BY row_to_json(t)::text),'[]'::json)::text FROM {table} t;" for table in tables]
        rows = self.psql(port, database, '\n'.join(queries))[0]
        for row in rows.splitlines():
            table, value = row.split('|', 1)
            data[table] = hashlib.sha256(value.encode()).hexdigest()
        schema = self.report / (database + '-schema.sql')
        self.run('pg_dump', '-h', '127.0.0.1', '-p', port, '-U', 'recovery_admin', '-w', '-d', database, '--schema-only', '--file', schema)
        lines = [line for line in schema.read_text(encoding='utf-8').splitlines() if not line.startswith(('\\restrict ', '\\unrestrict ', '--'))]
        grants = sorted((line for line in lines if line.startswith(('GRANT ', 'REVOKE '))))
        body = [line for line in lines if not line.startswith(('GRANT ', 'REVOKE '))]
        # Normaliza somente o AND associativo conhecido, sem retirar parênteses gerais.
        body = [line.replace('CHECK ((((anchor_day >= 1) AND (anchor_day <= 31)) AND ', 'CHECK (((anchor_day >= 1) AND (anchor_day <= 31) AND ') if 'CONSTRAINT ck_subscription_cycle_anchor CHECK' in line else line for line in body]
        normalized = '\n'.join(body + grants)
        counts = self.psql(port, database, "SELECT (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace),(SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal),(SELECT count(*) FROM pg_views WHERE schemaname IN ('public','dm'));")[0]
        database_acl = self.psql(port, database, "SELECT pg_get_userbyid(a.grantor),CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable FROM pg_database d,LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() ORDER BY 1,2,3,4;")[0]
        return {'tables': data, 'schema_sha256': hashlib.sha256(normalized.encode()).hexdigest(), 'routines_triggers_views': counts, 'database_acl': database_acl}

    def start_clusters(self):
        """Inicia somente clusters novos em loopback e provisiona o administrador restrito."""
        self.results['client_version'] = self.run('pg_dump', '--version')[0]
        for offset in (0, 1):
            data = self.lab / f'cluster{offset}'
            self.run('initdb', '-D', data, '-U', 'lab_super', '--auth=trust', '--encoding=UTF8', '--locale=C')
            self.run('pg_ctl', '-D', data, '-l', self.lab / f'cluster{offset}.log', '-w', 'start', '-o', f'-h 127.0.0.1 -p {self.args.port + offset}')
            self.started.append(data)
            self.psql(self.args.port + offset, 'postgres', 'CREATE ROLE recovery_admin LOGIN INHERIT NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;', user='lab_super')
            self.psql(self.args.port + offset, 'postgres', files=[HERE / 'provision_roles.sql'])

    def create_databases(self):
        """Cria os bancos e exige PostgreSQL 16.15."""
        for port, database in ((self.args.port, self.source), (self.args.port + 1, self.target)):
            self.psql(port, 'postgres', f'CREATE DATABASE {database} WITH TEMPLATE template0;')
            version = self.psql(port, database, 'SHOW server_version;')[0]
            version_num = self.psql(port, database, 'SHOW server_version_num;')[0]
            if version_num != '160015':
                raise RuntimeError(f'Exige PostgreSQL 16.15; encontrado {version}')
            self.results[database + '_admin'] = self.psql(port, database, 'SELECT current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user;')[0]
            self.results['server_version'] = version

    def install_source(self):
        """Instala o OLIUS e fixtures sintéticos; atualiza as materializadas."""
        scripts = ['01_structure.sql', '02_check_constraints.sql', '03_indexes.sql', '04_functions_procedures.sql', '05_triggers.sql', '06_ctes.sql', '07_window_functions.sql', '08_materialized_views.sql']
        scripts += ['data_catalog/' + s for s in ['01_structure.sql', '02_check_constraints.sql', '03_view.sql', '04_load.sql']]
        scripts += ['access_control/01_roles.sql', 'access_control/02_users.sql']
        for script in scripts:
            self.psql(self.args.port, self.source, files=[ROOT / 'PostgreSQL' / script])
        self.psql(self.args.port, self.source, files=[ROOT / 'PostgreSQL/tests/fixtures_procedures.sql'])
        self.psql(self.args.port, self.source, 'DROP SCHEMA olius_test CASCADE;')
        self.psql(self.args.port, self.source, 'BEGIN ISOLATION LEVEL REPEATABLE READ; CALL dm.refresh_data_mart(); COMMIT;')

    def create_backup(self):
        """Exporta estrutura, dados e ACLs com o administrador sem SUPERUSER."""
        self.dump = self.report / 'backup-lab.sql'
        self.run('pg_dump', '-h', '127.0.0.1', '-p', self.args.port, '-U', 'recovery_admin', '-w', '-d', self.source, '--format=plain', '--file', self.dump)

    def verify_negative_restore(self):
        """Comprova a falha sem privilégios temporários e o rollback."""
        _, error = self.psql(self.args.port + 1, self.target, files=[self.dump], extra=['--single-transaction'], expected=1)
        if 'permission denied for schema public' not in error:
            raise RuntimeError('Controle negativo não reproduziu falha de ownership: ' + error)
        remaining = self.psql(self.args.port + 1, self.target, "SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m');")[0]
        if remaining != '0':
            raise RuntimeError('A tentativa negativa deixou objetos no destino')
        self.results['negative_without_temporary_create'] = 'PASS: permission denied for schema public; rollback'

    def restore_target(self):
        """Recupera e provisiona contas somente depois dos objetos."""
        self.psql(self.args.port + 1, self.target, files=[HERE / 'prepare_restore.sql', self.dump, HERE / 'finish_restore.sql'], extra=['--single-transaction', '-v', f'source_database={self.source}'])
        self.psql(self.args.port + 1, self.target, files=[ROOT / 'PostgreSQL/access_control/02_users.sql'])

    def compare_target(self):
        """Compara todos os dados, DDL, ownership e permissões."""
        self.reference_inventory, b = (self.snapshot(self.args.port, self.source), self.snapshot(self.args.port + 1, self.target))
        (self.report / 'source-inventory.json').write_text(json.dumps(self.reference_inventory, indent=2), encoding='utf-8')
        (self.report / 'target-inventory.json').write_text(json.dumps(b, indent=2), encoding='utf-8')
        if self.reference_inventory != b:
            raise RuntimeError('Inventário divergente: comparar source/target-inventory.json e *-schema.sql')
        self.results['full_data_and_schema_comparison'] = f"PASS: {len(self.reference_inventory['tables'])} tabelas/views materializadas; SHA256 de todos os registros e DDL/owners/ACLs iguais"
        self.results['routines_triggers_views'] = self.reference_inventory['routines_triggers_views']

    def verify_same_server(self):
        """Repete a recuperação compartilhando os papéis da origem."""
        same = 'olius_backup_same_server'
        self.psql(self.args.port, 'postgres', f'CREATE DATABASE {same} WITH TEMPLATE template0;')
        self.psql(self.args.port, same, files=[HERE / 'prepare_restore.sql', self.dump, HERE / 'finish_restore.sql'], extra=['--single-transaction', '-v', f'source_database={self.source}'])
        self.psql(self.args.port, same, files=[ROOT / 'PostgreSQL/access_control/02_users.sql'])
        if self.snapshot(self.args.port, same) != self.reference_inventory:
            raise RuntimeError('Inventário divergente no mesmo servidor')
        self.results['same_server_restore'] = 'PASS: dados, DDL e ACLs iguais à origem'

    def verify_core(self):
        """Conecta realmente como Core; testa gravação, auditoria, auth e DDL negado."""
        self.psql(self.args.port + 1, self.target, "BEGIN; SELECT current_user,session_user; INSERT INTO public.users(name,email,password_hash,user_type) VALUES ('Recovery smoke','recovery-smoke@olius.test','hash-apenas-teste','CITIZENS'); SELECT count(*) FROM public.users WHERE email='recovery-smoke@olius.test'; COMMIT;", user='olius_core_api')
        count = self.psql(self.args.port + 1, self.target, "SELECT count(*) FROM public.users_log WHERE email='recovery-smoke@olius.test';")[0]
        if count != '1':
            raise RuntimeError('Auditoria da gravação Core não confirmada: ' + count)
        self.results['core_login_insert_and_audit_trigger'] = 'PASS: login olius_core_api, INSERT autorizado e log gerado'
        auth = self.psql(self.args.port + 1, self.target, "SELECT result_code FROM public.open_auth_session((SELECT id FROM public.users WHERE email='recovery-smoke@olius.test'),decode(repeat('ab',32),'hex'));", user='olius_core_api')[0]
        if auth != 'OK':
            raise RuntimeError('Autenticação recuperada não retornou OK: ' + auth)
        self.results['core_auth_security_definer'] = 'PASS: open_auth_session executada como olius_core_api'
        _, error = self.psql(self.args.port + 1, self.target, 'CREATE TABLE public.forbidden(id int);', user='olius_core_api', expected=1)
        if 'permission denied' not in error:
            raise RuntimeError(error)
        self.results['core_forbidden_ddl'] = 'PASS: CREATE TABLE negado'

    def verify_temporary_privileges(self):
        """Confere a revogação dos privilégios temporários."""
        self.results['internal_create_revoked'] = self.psql(self.args.port + 1, self.target, "SELECT rolname,has_schema_privilege(rolname,'public','CREATE') FROM pg_roles WHERE rolname IN ('olius_auth_owner','olius_business_owner') ORDER BY 1;")[0]
        if '|t' in self.results['internal_create_revoked']:
            raise RuntimeError('CREATE temporário não foi revogado')

    def finish(self):
        """Encerra clusters e grava as evidências, inclusive quando o teste falha."""
        for data in reversed(self.started):
            try:
                self.run('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')
            except Exception as exc:
                self.results.setdefault('cleanup_errors', []).append(str(exc))
        self.results['lab_directory'] = str(self.lab)
        (self.report / 'commands.log').write_text('\n'.join(self.transcript), encoding='utf-8')
        (self.report / 'results.json').write_text(json.dumps(self.results, indent=2, ensure_ascii=False), encoding='utf-8')
        print(json.dumps(self.results, indent=2, ensure_ascii=False))

    def execute(self):
        """Executa o fluxo completo e sempre finaliza o laboratório."""
        try:
            self.start_clusters()
            self.create_databases()
            self.install_source()
            self.create_backup()
            self.verify_negative_restore()
            self.restore_target()
            self.compare_target()
            self.verify_same_server()
            self.verify_core()
            self.verify_temporary_privileges()
            self.results['status'] = 'PASS'
        except Exception as exc:
            self.results['status'] = 'FAIL'
            self.results['error'] = str(exc)
            raise
        finally:
            self.finish()

def main():
    RecoveryValidation(parse_args()).execute()
if __name__ == '__main__':
    main()
