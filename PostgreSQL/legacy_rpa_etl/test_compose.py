"""Validate Compose combinations using fictitious settings; never starts services."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class ComposeTests(unittest.TestCase):
    def test_all_optional_combinations(self):
        compose = Path(__file__).parent / 'airflow'
        with tempfile.TemporaryDirectory() as folder:
            empty_env = Path(folder) / 'empty.env'
            empty_env.write_text('')
            environment = dict(os.environ)
            environment.update(AIRFLOW_METADATA_PASSWORD='fixture-only', AIRFLOW_FERNET_KEY='fixture-only',
                               AIRFLOW_JWT_SECRET='fixture-only', OLIUS_LEGACY_HOST='fixture.invalid',
                               OLIUS_LEGACY_PORT='5432', OLIUS_LEGACY_DATABASE='legacy',
                               OLIUS_LEGACY_CA_FILE=str(empty_env), OLIUS_LEGACY_PGPASS_FILE=str(empty_env),
                               OLIUS_CREDENTIAL_KEY_FILE=str(empty_env), OLIUS_TARGET_HOST='target.invalid',
                               OLIUS_TARGET_PORT='5432', OLIUS_TARGET_DATABASE='target', OLIUS_TARGET_USER='operator',
                               OLIUS_TARGET_CA_FILE=str(empty_env), OLIUS_TARGET_PGPASS_FILE=str(empty_env),
                               OLIUS_ETL_CONFIRMED_TARGET='target.invalid:5432/target',
                               OLIUS_HISTORY_KEY_FILE=str(empty_env), OLIUS_HISTORY_PRIVATE_DIR=folder,
                               OLIUS_HISTORY_BACKUP_DIR=folder, OLIUS_HISTORY_REPORT_DIR=folder,
                               OLIUS_ETL_LOAD_ENABLED='false', OLIUS_ETL_ARCHIVE_ENABLED='false')
            for extras in [[], ['compose.load.yaml'], ['compose.archive.yaml'],
                           ['compose.load.yaml', 'compose.archive.yaml']]:
                command = ['docker', 'compose', '--env-file', str(empty_env), '-f', str(compose / 'compose.yaml')]
                for extra in extras:
                    command += ['-f', str(compose / extra)]
                result = subprocess.run(command + ['config', '--quiet'], env=environment,
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, 'Compose configuration rejected: ' + str(extras))
