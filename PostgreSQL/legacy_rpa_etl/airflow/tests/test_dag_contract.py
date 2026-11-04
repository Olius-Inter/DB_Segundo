"""Run inside the pinned Airflow image; requires no database connection."""
import unittest

from airflow.dag_processing.dagbag import DagBag
from airflow.sdk.exceptions import AirflowSkipException


class DagContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bag = DagBag(dag_folder='/opt/airflow/dags', safe_mode=False)

    def test_no_import_errors(self):
        self.assertEqual(self.bag.import_errors, {})

    def test_manual_single_run_graph(self):
        dag = self.bag.dags['olius_legacy_preparation']
        self.assertIsNone(dag.schedule)
        self.assertFalse(dag.catchup)
        self.assertEqual(dag.max_active_runs, 1)
        self.assertEqual(dag.max_active_tasks, 1)
        self.assertEqual(set(dag.task_ids),
                         {'extract_legacy', 'prepare_citizens', 'summarize', 'load_citizens', 'reconcile_destination'})
        self.assertEqual(dag.get_task('extract_legacy').downstream_task_ids, {'prepare_citizens'})
        self.assertEqual(dag.get_task('prepare_citizens').downstream_task_ids, {'summarize'})
        self.assertEqual(dag.get_task('summarize').downstream_task_ids, {'load_citizens'})
        self.assertEqual(dag.get_task('load_citizens').downstream_task_ids, {'reconcile_destination'})
        self.assertEqual(dag.get_task('extract_legacy').retries, 1)

    def test_publication_is_explicitly_skipped(self):
        from unittest.mock import patch
        dag = self.bag.dags['olius_legacy_preparation']
        with patch.dict('os.environ', {'OLIUS_ETL_LOAD_ENABLED': 'false'}):
            with self.assertRaises(AirflowSkipException):
                dag.get_task('load_citizens').python_callable('fixture-run')


if __name__ == '__main__':
    unittest.main()
