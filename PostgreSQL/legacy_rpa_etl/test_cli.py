from test_file_policy import PathTestCase
import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pipeline import main, open_stage


class CliTests(PathTestCase):
    def test_prepare_report_and_safe_missing_settings(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'stage.sqlite'
            stage = open_stage(path)
            stage.execute("INSERT INTO runs VALUES('run','2026-11-04','fixture','EXTRACTED')")
            stage.commit(); stage.close()
            for step in ('prepare', 'report'):
                with patch('sys.argv', ['pipeline', step, '--stage', str(path), '--run-id', 'run']), \
                     redirect_stdout(io.StringIO()) as output:
                    main()
                    self.assertEqual(json.loads(output.getvalue())['status'], 'PREPARED')
            for step in ('extract', 'load', 'reconcile'):
                args = ['pipeline', step, '--stage', str(path), '--run-id', 'run']
                with patch('sys.argv', args), patch.dict(os.environ, {}, clear=True), \
                     redirect_stdout(io.StringIO()) as output:
                    with self.assertRaises(SystemExit):
                        main()
                    self.assertEqual(json.loads(output.getvalue())['status'], 'FAILED')

    def test_extract_cli_has_explicit_settings_without_password(self):
        with tempfile.TemporaryDirectory() as folder:
            environment = {'OLIUS_LEGACY_HOST': 'fixture.invalid', 'OLIUS_LEGACY_PORT': '5432',
                           'OLIUS_LEGACY_DATABASE': 'legacy', 'OLIUS_LEGACY_USER': 'reader',
                           'OLIUS_LEGACY_CA': '/fixture/ca.pem', 'OLIUS_ETL_STAGE_ROOT': folder}
            args = ['pipeline', 'extract', '--stage', str(Path(folder) / 's.sqlite'), '--run-id', 'explicit-batch']
            with patch('sys.argv', args), patch.dict(os.environ, environment, clear=True), \
                 patch('pipeline.extract', return_value='run') as extract, \
                 patch('pipeline.report', return_value={}), patch('psycopg2.connect') as connect, \
                 redirect_stdout(io.StringIO()):
                main()
                self.assertEqual(extract.call_args.kwargs['run_id'], 'explicit-batch')
                extract.call_args.args[2]()
                self.assertNotIn('password', connect.call_args.kwargs)
                self.assertEqual(connect.call_args.kwargs['sslmode'], 'verify-full')
