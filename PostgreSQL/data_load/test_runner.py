"""Pré-condições relevantes da carga; nenhum teste conecta ao banco real."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import run


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads(Path(__file__).with_name("config.json").read_text(encoding="utf-8"))

    def check_config(self, value):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "config.json"
            file.write_text(json.dumps(value), encoding="utf-8")
            return run.load_config(file)

    def test_official_plans_without_invented_certificate_levels(self):
        self.assertEqual(self.check_config(self.config)["certificate_levels"], [])

    def test_upgrades_require_increasing_both_limits(self):
        self.config["plans"][2]["collection_limit"] = 4
        with self.assertRaisesRegex(ValueError, "ambos os limites"):
            self.check_config(self.config)

    def test_mass_refuses_capacity_below_eight_requests(self):
        self.config["plans"][2]["collection_limit"] = 7
        with self.assertRaisesRegex(ValueError, "8 vagas"):
            self.check_config(self.config)

    def test_undefined_certificates_cannot_be_silently_filled(self):
        self.config["certificate_levels"] = [{"name": "Não aprovado", "required_liters": 1}]
        with self.assertRaisesRegex(ValueError, "pendentes"):
            self.check_config(self.config)

    def test_container_without_disposable_label_refuses_sql_execution(self):
        with patch("sys.argv", ["run.py", "--container", "untrusted"]), \
             patch.dict("os.environ", {"OLIUS_DATA_LOAD_DISPOSABLE": "1"}), \
             patch.object(run, "command", return_value="{}") as execute:
            with self.assertRaisesRegex(ValueError, "descartável"):
                run.main()
            self.assertEqual(execute.call_count, 1)

    def test_invalid_identifiers(self):
        for value in ('--privileged', '../other', 'db name', 'db;command', ''):
            with self.assertRaises(run.argparse.ArgumentTypeError):
                run.identifier(value)
        self.assertEqual(run.identifier('olius-test_1'), 'olius-test_1')

    def test_command_executes_without_shell_and_reports_errors(self):
        with patch.object(run.shutil, 'which', return_value='/usr/bin/docker'), \
             patch.object(run.subprocess, 'run') as process:
            process.return_value = run.subprocess.CompletedProcess([], 0, 'ok', '')
            self.assertEqual(run.command(['docker', 'inspect', 'valid']), 'ok')
            self.assertEqual(process.call_args.args[0][0], '/usr/bin/docker')
            self.assertNotIn('shell', process.call_args.kwargs)
            process.return_value = run.subprocess.CompletedProcess([], 1, '', 'failure')
            with self.assertRaisesRegex(RuntimeError, 'failure'):
                run.command(['docker', 'inspect', 'valid'])
        with self.assertRaises(ValueError):
            run.command(['other'])
        with patch.object(run.shutil, 'which', return_value=None):
            with self.assertRaises(FileNotFoundError):
                run.command(['docker'])

    def test_invalid_configuration(self):
        for field, value in [('name', ''), ('monthly_price', 'NaN'),
                             ('volume_limit_liters', '1.001'), ('collection_limit', True)]:
            config = json.loads(json.dumps(self.config))
            config['plans'][0][field] = value
            with self.assertRaises(ValueError):
                self.check_config(config)
        self.config['plans'].pop()
        with self.assertRaises(ValueError):
            self.check_config(self.config)

    def run_fake_install(self, fault=None, windows=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ('01_structure.sql', '02_check_constraints.sql', '03_indexes.sql',
                             '04_functions_procedures.sql', '05_triggers.sql', '06_ctes.sql',
                             '07_window_functions.sql', 'data_catalog/01_structure.sql',
                             'data_catalog/02_check_constraints.sql', 'data_catalog/03_view.sql',
                             'data_catalog/04_load.sql', 'access_control/01_roles.sql',
                             'access_control/02_users.sql'):
                file = root / relative
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('-- fixture', encoding='utf-8')

            def docker(arguments, input_text=None, timeout=180):
                if 'inspect' in arguments:
                    return '{"org.olius.data_load.disposable":"true"}'
                if 'mktemp' in arguments:
                    if fault == 'temporary':
                        return '/tmp/other-directory'
                    return '/var/lib/postgresql/olius-data-load.Abc123XyZ9\n'
                if 'cp' in arguments and fault == 'copy':
                    raise RuntimeError('Cópia recusada')
                if input_text and 'server_version' in input_text:
                    return '17.0' if fault == 'version' else '16.15\n'
                if input_text and 'pg_class' in input_text:
                    return '1' if fault == 'schema' else '0'
                if input_text and 'pg_roles' in input_text:
                    return 't'
                if input_text and 'Tabela %' in input_text and fault == 'populated':
                    raise RuntimeError('Tabela citizens não vazia')
                if '-f' in arguments and arguments[-1].endswith('04_validate.sql'):
                    return '{"valid_operations":598}'
                return ''

            argv = ['run.py', '--container', 'olius-test', '--source-root', str(root),
                    '--report-dir', str(root / 'coverage'), '--install', '--install-access-control']
            with patch('sys.argv', argv), patch.dict('os.environ', {'OLIUS_DATA_LOAD_DISPOSABLE': '1'}), \
                 patch.object(run, 'command', side_effect=docker) as execute, patch.object(run, 'REPORT_ROOT', root):
                if fault:
                    with self.assertRaises((ValueError, RuntimeError)):
                        run.main()
                    self.assertEqual(json.loads((root / 'coverage/manifest.json').read_text(encoding='utf-8'))['status'], 'failed')
                else:
                    run.main()
                    manifest = json.loads((root / 'coverage/manifest.json').read_text(encoding='utf-8'))
                    self.assertEqual(manifest['result']['valid_operations'], 598)
                    self.assertEqual(manifest['journeys_role'], 'olius_api')
                    self.assertEqual(len(manifest['completed']), 4)
                    self.assertTrue(any('rm' in call.args[0] for call in execute.call_args_list))

    def test_install_orchestration_and_manifest(self):
        self.run_fake_install()

    def test_version_schema_and_populated_database_are_refused(self):
        for fault in ('version', 'schema', 'populated', 'temporary', 'copy'):
            self.run_fake_install(fault)

    def test_environment_and_install_contract(self):
        with patch('sys.argv', ['run.py', '--container', 'valid']), patch.dict('os.environ', {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'DISPOSABLE'):
                run.main()
        with patch('sys.argv', ['run.py', '--container', 'valid', '--install-access-control']):
            with self.assertRaisesRegex(ValueError, 'requer'):
                run.main()

    def direct_arguments(self, **overrides):
        values = dict(container=None, host='database.example.com', port=26714,
                      database='olius_dev', user='loader', development=True,
                      install=False, install_access_control=False,
                      ssl_mode='verify-full', ssl_root_cert=None)
        return SimpleNamespace(**{**values, **overrides})

    def test_reports_accept_only_project_output_directories(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(run, 'REPORT_ROOT', Path(directory)):
            root = Path(directory).resolve()
            for relative in ('coverage/data-load', 'PostgreSQL/data_load/reports'):
                path = root / relative
                self.assertEqual(run.report_directory(path), path)
                self.assertTrue(path.is_dir())
            for path in (root / 'coverage-other', root / 'coverage/../../outside', root.parent / 'untrusted-report'):
                with self.assertRaisesRegex(ValueError, 'Relatórios'):
                    run.report_directory(path)

    def test_report_files_reject_traversal_and_symbolic_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            self.assertEqual(run.report_file(root, 'manifest.json'), root / 'manifest.json')
            for name in ('../manifest.json', 'sub/file.log', 'C:\\outside.json'):
                with self.assertRaisesRegex(ValueError, 'Nome'):
                    run.report_file(root, name)
            with patch.object(Path, 'is_symlink', return_value=True):
                with self.assertRaisesRegex(ValueError, 'Links'):
                    run.report_file(root, 'manifest.json')

    def test_report_directory_rejects_existing_symlink_to_outside(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root = Path(directory).resolve()
            link = root / 'coverage'
            try:
                link.symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest('Criação de symlink não autorizada neste Windows; o caso roda no CI Linux.')
            with patch.object(run, 'REPORT_ROOT', root):
                with self.assertRaisesRegex(ValueError, 'Relatórios'):
                    run.report_directory(link / 'data-load')

    def test_direct_target_requires_exact_confirmation_and_existing_structure(self):
        args = self.direct_arguments()
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'Confirme'):
                run.validate_target(args)
        with patch.dict('os.environ', {'OLIUS_DATA_LOAD_DEVELOPMENT_TARGET': 'database.example.com:26714/olius_dev'}, clear=True):
            run.validate_target(args)
            install_args = self.direct_arguments(install=True)
            with self.assertRaisesRegex(ValueError, 'reinstalar'):
                run.validate_target(install_args)
        direct_args = self.direct_arguments(development=False)
        with self.assertRaisesRegex(ValueError, 'direta exige'):
            run.validate_target(direct_args)

    def test_direct_connection_keeps_credentials_out_of_arguments(self):
        with tempfile.TemporaryDirectory() as directory:
            ca = Path(directory) / 'ca.pem'
            ca.write_text('certificate fixture')
            args = self.direct_arguments(ssl_root_cert=ca)
            with patch.dict('os.environ', {'PGPASSWORD': 'test-secret', 'PGHOSTADDR': 'unwanted'}, clear=True):
                command, environment = run.connection(args)
            self.assertEqual(command[0], 'psql')
            self.assertIn('-w', command)
            self.assertNotIn('test-secret', str(command))
            self.assertEqual(environment['PGPASSWORD'], 'test-secret')
            self.assertEqual(environment['PGSSLMODE'], 'verify-full')
            self.assertEqual(environment['PGSSLROOTCERT'], str(ca.resolve()))
            self.assertEqual(environment['PGHOSTADDR'], '')
            self.assertEqual(environment['PGSERVICE'], '')
        absent_args = self.direct_arguments(ssl_root_cert=Path(directory) / 'absent.pem')
        with self.assertRaises(FileNotFoundError):
            run.connection(absent_args)
        with tempfile.TemporaryDirectory() as directory:
            directory_args = self.direct_arguments(ssl_root_cert=Path(directory))
            with self.assertRaises(ValueError):
                run.connection(directory_args)

    def test_docker_development_confirmation_and_installation_guards(self):
        args = self.direct_arguments(container='olius-dev', host=None, database='olius_dev')
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'Confirme'):
                run.validate_target(args)
        confirmation = {'OLIUS_DATA_LOAD_DEVELOPMENT_TARGET': 'olius-dev/olius_dev'}
        with patch.dict('os.environ', confirmation, clear=True):
            run.validate_target(args)
            for install_access_control in (False, True):
                install_args = self.direct_arguments(container='olius-dev', host=None,
                                                     install=True, install_access_control=install_access_control)
                with self.assertRaisesRegex(ValueError, 'reinstalar'):
                    run.validate_target(install_args)

    def test_host_and_port_validation(self):
        for value in ('https://server', '--host', 'host name', 'user:secret@host'):
            with self.assertRaises(run.argparse.ArgumentTypeError):
                run.hostname(value)
        self.assertEqual(run.hostname('127.0.0.1'), '127.0.0.1')
        self.assertEqual(run.port_number('5432'), 5432)
        for value in ('0', '65536'):
            with self.assertRaises(run.argparse.ArgumentTypeError):
                run.port_number(value)

    def test_direct_files_are_local_and_never_copied_or_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            sql = Path(directory) / '00_helpers.sql'
            sql.write_text('SELECT 1;')
            manifest = {'scripts': {}}
            with patch.object(run, 'command') as command:
                path = run.prepare_files(self.direct_arguments(), Path(directory), manifest)
                command.assert_not_called()
            self.assertEqual(path, Path(directory).as_posix())
            self.assertTrue(sql.exists())
            self.assertIn('data_load/00_helpers.sql', manifest['scripts'])

    def test_psql_subprocess_receives_ssl_environment_without_shell(self):
        with patch.object(run.shutil, 'which', return_value='/usr/bin/psql'), \
             patch.object(run.subprocess, 'run') as process:
            process.return_value = run.subprocess.CompletedProcess([], 0, 'ok', '')
            self.assertEqual(run.command(['psql', '-X'], environment={'PGSSLMODE': 'verify-full'}), 'ok')
            self.assertEqual(process.call_args.kwargs['env']['PGSSLMODE'], 'verify-full')
            self.assertNotIn('shell', process.call_args.kwargs)

    def test_direct_orchestration_preserves_local_files_and_manifest_has_no_password(self):
        for fault in (None, 'structure', 'populated', 'error-path'):
            with tempfile.TemporaryDirectory() as directory:
                argv = ['run.py', '--host', 'database.example.com', '--port', '26714',
                        '--database', 'olius_dev', '--user', 'loader', '--development',
                        '--report-dir', str(Path(directory) / 'coverage')]

                def psql(arguments, input_text=None, timeout=180, environment=None):
                    self.assertEqual(arguments[0], 'psql')
                    self.assertEqual(environment['PGSSLMODE'], 'verify-full')
                    self.assertNotIn('secret-fixture', str(arguments))
                    if input_text and 'server_version' in input_text:
                        if fault == 'error-path':
                            raise RuntimeError('../outside.json — falha simulada')
                        return '16.15'
                    if input_text and 'pg_catalog.pg_class' in input_text:
                        return 'f' if fault == 'structure' else 't'
                    if input_text and 'Tabela %' in input_text and fault == 'populated':
                        raise RuntimeError('Tabela users não vazia')
                    if input_text and 'pg_roles' in input_text:
                        return 'f'
                    if '-f' in arguments:
                        self.assertTrue(Path(arguments[-1]).is_file())
                        if arguments[-1].endswith('04_validate.sql'):
                            return '{"valid_operations":598}'
                    return ''

                with patch('sys.argv', argv), patch.dict('os.environ', {
                    'OLIUS_DATA_LOAD_DEVELOPMENT_TARGET': 'database.example.com:26714/olius_dev',
                    'PGPASSWORD': 'secret-fixture'}, clear=True), patch.object(run, 'command', side_effect=psql), \
                     patch.object(run, 'REPORT_ROOT', Path(directory)):
                    if fault:
                        with self.assertRaises((ValueError, RuntimeError)):
                            run.main()
                    else:
                        run.main()
                manifest_text = (Path(directory) / 'coverage/manifest.json').read_text(encoding='utf-8')
                manifest = json.loads(manifest_text)
                self.assertNotIn('secret-fixture', manifest_text)
                if fault == 'error-path':
                    self.assertEqual(manifest['error'], '../outside.json — falha simulada')
                    self.assertFalse((Path(directory) / 'outside.json').exists())
                self.assertEqual(manifest['target']['transport'], 'postgresql')
                self.assertEqual(manifest['target']['host'], 'database.example.com')
                self.assertEqual(manifest['target']['database'], 'olius_dev')
                self.assertEqual(manifest['status'], 'failed' if fault else 'validated')
                if fault:
                    self.assertEqual(manifest['completed'], [])
                else:
                    self.assertEqual(manifest['journeys_role'], 'loader')
                    self.assertEqual(len(manifest['completed']), 4)


if __name__ == "__main__":
    unittest.main()
