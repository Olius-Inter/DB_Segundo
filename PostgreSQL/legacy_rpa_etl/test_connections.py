import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from connections import destination_connection


class DestinationTests(unittest.TestCase):
    def test_verified_tls_and_temporary_passfile(self):
        with tempfile.TemporaryDirectory() as folder:
            passfile = Path(folder) / 'pgpass'
            passfile.write_text('fixture.invalid:5432:target:operator:fixture-only')
            environment = {'OLIUS_TARGET_HOST': 'fixture.invalid', 'OLIUS_TARGET_PORT': '5432',
                           'OLIUS_TARGET_DATABASE': 'target', 'OLIUS_TARGET_USER': 'operator',
                           'OLIUS_TARGET_CA': '/fixture/ca.pem', 'OLIUS_TARGET_PGPASS': str(passfile),
                           'OLIUS_ETL_CONFIRMED_TARGET': 'fixture.invalid:5432/target'}
            with patch.dict(os.environ, environment, clear=True), patch('psycopg2.connect') as connect:
                def check(**settings):
                    self.assertEqual(settings['sslmode'], 'verify-full')
                    self.assertEqual(Path(settings['passfile']).read_text(), passfile.read_text())
                    self.assertNotIn('password', settings)
                    return 'connection-fixture'
                connect.side_effect = check
                self.assertEqual(destination_connection(), 'connection-fixture')
                self.assertFalse(Path(connect.call_args.kwargs['passfile']).exists())
                os.environ['OLIUS_ETL_CONFIRMED_TARGET'] = 'wrong-target'
                with self.assertRaises(ValueError):
                    destination_connection()
                os.environ['OLIUS_ETL_CONFIRMED_TARGET'] = 'fixture.invalid:5432/target'
                os.environ.update(OLIUS_LEGACY_HOST='fixture.invalid', OLIUS_LEGACY_PORT='5432',
                                  OLIUS_LEGACY_DATABASE='target')
                with self.assertRaises(ValueError):
                    destination_connection()
                self.assertEqual(connect.call_count, 1)
