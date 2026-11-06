import importlib.util
from pathlib import Path
import tempfile
import json
from types import SimpleNamespace
from unittest.mock import patch
from test_file_policy import PathTestCase

spec = importlib.util.spec_from_file_location('host_start', Path(__file__).parent / 'airflow/start.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class HostMountTests(PathTestCase):
    def test_distinct_outputs_and_secret_are_allowed_but_overlap_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = [root / name for name in ('private','backup','reports','keys')]
            for path in paths:
                path.mkdir()
            key = paths[-1] / 'key'; key.write_bytes(b'fixture')
            targets = ('/opt/olius-history/private','/opt/olius-history/backup','/opt/olius-history/reports')
            config = {'services': {'airflow': {'volumes': [dict(type='bind',source=str(path),target=target)
                for path,target in zip(paths,targets)]}}, 'secrets': {'key': {'file':str(key)}}}
            host.validate_mounts(config)
            config['services']['airflow']['volumes'][2]['source'] = str(root)
            with self.assertRaises(ValueError):
                host.validate_mounts(config)
            config['services']['airflow']['volumes'][2]['source'] = str(paths[2])
            config['secrets']['key']['file'] = str(paths[2] / 'key')
            (paths[2] / 'key').write_bytes(b'fixture')
            with self.assertRaises(ValueError):
                host.validate_mounts(config)

    def test_launcher_checks_config_before_starting_without_printing_secrets(self):
        valid = {'services': {'airflow': {'volumes': []}}}
        config = SimpleNamespace(returncode=0, stdout=json.dumps(valid))
        with patch('sys.argv', ['start', '--load']), patch.object(host.subprocess, 'run',
                side_effect=[config, SimpleNamespace(returncode=0)]) as run:
            self.assertEqual(host.main(), 0)
            self.assertIn('compose.load.yaml', ' '.join(run.call_args_list[0].args[0]))
            self.assertEqual(run.call_args_list[1].args[0][-3:], ['up', '-d', '--build'])
        for result in (SimpleNamespace(returncode=1, stdout='PRIVATE'),
                       SimpleNamespace(returncode=0, stdout='PRIVATE'),
                       SimpleNamespace(returncode=0, stdout='{}')):
            with patch('sys.argv', ['start', '--archive']), patch.object(host.subprocess, 'run', return_value=result) as run:
                with self.assertRaises(SystemExit) as error:
                    host.main()
                self.assertNotIn('PRIVATE', str(error.exception))
                run.assert_called_once()
