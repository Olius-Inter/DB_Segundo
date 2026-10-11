"""Pré-condições relevantes da carga; nenhum teste conecta ao banco real."""
import json
from pathlib import Path
import tempfile
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
                    '--report-dir', str(root / 'reports'), '--install', '--install-access-control']
            with patch('sys.argv', argv), patch.dict('os.environ', {'OLIUS_DATA_LOAD_DISPOSABLE': '1'}), \
                 patch.object(run, 'command', side_effect=docker) as execute:
                if fault:
                    with self.assertRaises((ValueError, RuntimeError)):
                        run.main()
                    self.assertEqual(json.loads((root / 'reports/manifest.json').read_text())['status'], 'failed')
                else:
                    run.main()
                    manifest = json.loads((root / 'reports/manifest.json').read_text())
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


if __name__ == "__main__":
    unittest.main()
