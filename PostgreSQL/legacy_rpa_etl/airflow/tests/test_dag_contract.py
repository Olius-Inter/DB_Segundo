"""Run inside the pinned Airflow image; requires no database connection."""
import unittest
import os
import io
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from cryptography.fernet import Fernet

from airflow.dag_processing.dagbag import DagBag
from airflow.sdk.exceptions import AirflowSkipException


class DagContractTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch('stage_state.frozen', return_value=False))

    @classmethod
    def setUpClass(cls):
        cls.bag = DagBag(dag_folder=os.environ.get('OLIUS_DAG_FOLDER', '/opt/airflow/dags'), safe_mode=False)

    def test_no_import_errors(self):
        self.assertEqual(self.bag.import_errors, {})

    def test_task_arguments_do_not_shadow_airflow_context(self):
        import inspect
        for task in self.bag.dags['olius_legacy_preparation'].tasks:
            self.assertFalse({'run_id', 'dag_run', 'ti', 'task_instance', 'dag'}
                             & set(inspect.signature(task.python_callable).parameters))

    def test_manual_single_run_graph(self):
        dag = self.bag.dags['olius_legacy_preparation']
        self.assertIsNone(dag.schedule)
        self.assertFalse(dag.catchup)
        self.assertEqual(dag.max_active_runs, 1)
        self.assertEqual(dag.max_active_tasks, 1)
        self.assertEqual(set(dag.task_ids),
                         {'extract_legacy', 'prepare_citizens', 'summarize', 'load_citizens',
                          'reconcile_destination', 'archive_history', 'workflow_finished'})
        self.assertEqual(dag.get_task('extract_legacy').downstream_task_ids, {'prepare_citizens'})
        self.assertEqual(dag.get_task('prepare_citizens').downstream_task_ids, {'summarize'})
        self.assertEqual(dag.get_task('summarize').downstream_task_ids, {'load_citizens', 'archive_history'})
        self.assertEqual(dag.get_task('load_citizens').downstream_task_ids,
                         {'reconcile_destination', 'workflow_finished'})
        self.assertEqual(dag.get_task('extract_legacy').retries, 1)
        self.assertEqual(dag.get_task('reconcile_destination').downstream_task_ids,
                         {'archive_history', 'workflow_finished'})
        self.assertEqual(dag.get_task('archive_history').trigger_rule, 'all_done')
        self.assertEqual(dag.get_task('workflow_finished').trigger_rule, 'none_failed')
        self.assertEqual({task.task_id for task in dag.leaves}, {'workflow_finished'})
        self.assertIsNone(dag.get_task('workflow_finished').python_callable())

    def test_publication_is_explicitly_skipped(self):
        from unittest.mock import patch
        dag = self.bag.dags['olius_legacy_preparation']
        with patch.dict('os.environ', {'OLIUS_ETL_LOAD_ENABLED': 'false'}):
            with self.assertRaises(AirflowSkipException):
                dag.get_task('load_citizens').python_callable('fixture-run')

    def call(self, name, *args):
        return self.bag.dags['olius_legacy_preparation'].get_task(name).python_callable(*args)

    def test_prepare_and_summary_close_stage(self):
        for name, function in [('prepare_citizens', 'prepare'), ('summarize', 'report')]:
            with self.subTest(name=name), patch.dict(os.environ, {'OLIUS_STAGE_PATH': 'fixture'}), \
                 patch('pipeline.open_stage') as opened, patch('pipeline.' + function) as action, \
                 redirect_stdout(io.StringIO()):
                action.return_value = {}
                self.assertEqual(self.call(name, 'run'), 'run')
                opened.return_value.close.assert_called_once()

    def test_frozen_batch_resumes_without_repreparation(self):
        with patch.dict(os.environ, {'OLIUS_STAGE_PATH': 'fixture', 'OLIUS_ETL_EXTENDED_LOAD_ENABLED': 'true'}), \
             patch('pipeline.open_stage') as opened, patch('pipeline.prepare') as prepare, \
             patch('stage_state.frozen', return_value=True), patch('stage_state.prepared') as prepared, \
             patch('stage_state.require_extended') as extended:
            self.assertEqual(self.call('prepare_citizens', 'batch'), 'batch')
            prepared.assert_called_once_with(opened.return_value, 'batch')
            extended.assert_called_once_with(opened.return_value, 'batch')
            prepare.assert_not_called()
            opened.return_value.close.assert_called_once()

    def test_prepare_reads_optional_cpf_secret(self):
        with patch.dict(os.environ, {'OLIUS_STAGE_PATH': 'fixture',
                                    'OLIUS_LEGACY_CPF_KEY_FILE': '/run/secrets/fixture'}), \
             patch('pipeline.open_stage') as opened, patch('pipeline.prepare') as prepared, \
             patch('pipeline.read_cpf_key', return_value=b'fixture-key') as read:
            self.assertEqual(self.call('prepare_citizens', 'batch'), 'batch')
            read.assert_called_once_with('/run/secrets/fixture')
            prepared.assert_called_once_with(opened.return_value, 'batch', b'fixture-key')
            opened.return_value.close.assert_called_once()

    def test_extended_preparation_loading_and_reconciliation_are_opt_in(self):
        environment = {'OLIUS_STAGE_PATH': 'fixture', 'OLIUS_B2B_COMPLEMENT_FILE': '/private/b2b',
                       'OLIUS_DRIVER_COMPLEMENT_FILE': '/private/drivers',
                       'OLIUS_ETL_LOAD_ENABLED': 'true', 'OLIUS_ETL_EXTENDED_LOAD_ENABLED': 'true'}
        with patch.dict(os.environ, environment), patch('pipeline.open_stage') as opened, \
             patch('pipeline.prepare'), patch('extended.prepare_extended') as prepared, \
             patch('extended.run_extended') as loaded, patch('loader.load'), patch('loader.reconcile'), \
             patch('pipeline.report', return_value={}), \
             patch('pathlib.Path.read_bytes', return_value=Fernet.generate_key()), \
             redirect_stdout(io.StringIO()):
            self.call('prepare_citizens', 'batch')
            self.assertEqual(prepared.call_count, 2)
            self.call('load_citizens', 'batch')
            loaded.assert_called_once()
            self.call('reconcile_destination', 'batch')
            self.assertTrue(loaded.call_args.kwargs['reconcile_only'])
            self.assertEqual(loaded.call_count, 2)

    def test_load_reconciliation_and_archive_delegate_without_exposing_secrets(self):
        environment = {'OLIUS_STAGE_PATH': 'fixture', 'OLIUS_ETL_LOAD_ENABLED': 'true',
                       'OLIUS_ETL_ARCHIVE_ENABLED': 'true'}
        for name, function in [('load_citizens', 'loader.load'),
                               ('reconcile_destination', 'loader.reconcile'),
                               ('archive_history', 'archive.export_history')]:
            with self.subTest(name=name), patch.dict(os.environ, environment), \
                 patch('pipeline.open_stage') as opened, patch(function) as action, \
                 patch('pipeline.report', return_value={}), \
                 patch('pathlib.Path.read_bytes', return_value=Fernet.generate_key()), \
                 redirect_stdout(io.StringIO()) as output:
                action.return_value = {}
                opened.return_value.execute.return_value.fetchone.return_value = ('PREPARED',)
                self.call(name, 'run')
                action.assert_called_once()
                opened.return_value.close.assert_called_once()
                self.assertNotIn('pbkdf2', output.getvalue())

    def test_task_failures_are_sanitized_and_close_stage(self):
        environment = {'OLIUS_STAGE_PATH': 'fixture', 'OLIUS_ETL_LOAD_ENABLED': 'true',
                       'OLIUS_ETL_ARCHIVE_ENABLED': 'true'}
        for name, function in [('prepare_citizens', 'pipeline.prepare'),
                               ('load_citizens', 'loader.load'),
                               ('reconcile_destination', 'loader.reconcile'),
                               ('archive_history', 'archive.export_history')]:
            with self.subTest(name=name), patch.dict(os.environ, environment), \
                 patch('pipeline.open_stage') as opened, \
                 patch(function, side_effect=ValueError('PRIVATE_SECRET')), \
                 patch('pathlib.Path.read_bytes', return_value=Fernet.generate_key()):
                with self.assertRaises(RuntimeError) as error:
                    opened.return_value.execute.return_value.fetchone.return_value = ('PREPARED',)
                    self.call(name, 'run')
                self.assertNotIn('PRIVATE_SECRET', str(error.exception))
                opened.return_value.close.assert_called_once()

    def test_extraction_passes_key_and_reuses_stable_run_identity(self):
        environment = {'OLIUS_STAGE_PATH': 'fixture', 'OLIUS_LEGACY_HOST': 'fixture.invalid',
                       'OLIUS_LEGACY_PORT': '5432', 'OLIUS_LEGACY_DATABASE': 'fixture',
                       'OLIUS_LEGACY_USER': 'reader', 'OLIUS_LEGACY_CA': '/fixture/ca.pem'}
        task = self.bag.dags['olius_legacy_preparation'].get_task('extract_legacy')
        with patch.dict(os.environ, environment), patch('pipeline.open_stage') as opened, \
             patch('pipeline.extract', return_value='run') as extracted, \
             patch.dict(task.python_callable.__globals__,
                        get_current_context=lambda: {'dag': SimpleNamespace(dag_id='fixture'), 'run_id': 'run'}), \
             patch('shutil.copyfile'), patch('os.chmod'), \
             patch('pathlib.Path.read_bytes', return_value=Fernet.generate_key()):
            self.assertEqual(self.call('extract_legacy'), 'run')
            first = extracted.call_args.kwargs['run_id']
            self.assertEqual(self.call('extract_legacy'), 'run')
            self.assertEqual(first, extracted.call_args.kwargs['run_id'])
            extracted.side_effect = ValueError('PRIVATE_SECRET')
            with self.assertRaises(RuntimeError) as error:
                self.call('extract_legacy')
            self.assertNotIn('PRIVATE_SECRET', str(error.exception))
            self.assertEqual(opened.return_value.close.call_count, 3)

    def test_archive_does_not_run_without_opt_in_or_prepared_snapshot(self):
        for run in (None, 'run'):
            with patch.dict(os.environ, {'OLIUS_ETL_ARCHIVE_ENABLED': 'false'}):
                with self.assertRaises(AirflowSkipException):
                    self.call('archive_history', run)


if __name__ == '__main__':
    unittest.main()
