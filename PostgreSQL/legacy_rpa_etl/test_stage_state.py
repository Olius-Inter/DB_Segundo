from pathlib import Path
import json
from unittest.mock import MagicMock, patch
from test_file_policy import PathTestCase
from pipeline import open_stage, prepare
from stage_state import bind_target, frozen, require_extended, confirm
from loader import reconcile, load
from extended import prepare_extended, run_extended


class BatchStateTests(PathTestCase):
    def setUp(self):
        super().setUp()
        import tempfile
        self.stage = open_stage(Path(tempfile.gettempdir()) / 'batch.sqlite')
        self.addCleanup(self.stage.close)
        self.stage.execute("INSERT INTO runs VALUES('run','now','fixture','PREPARED')")
        self.stage.commit()

    def connection(self, database='target'):
        connection = MagicMock()
        connection.get_dsn_parameters.return_value = dict(host='fixture', port='5432', dbname=database)
        return connection

    def test_target_is_durable_before_first_result_and_shared_by_both_loaders(self):
        target = bind_target(self.stage, 'run', self.connection())
        self.assertTrue(frozen(self.stage, 'run'))
        self.assertEqual(bind_target(self.stage, 'run', self.connection()), target)
        self.stage.execute("INSERT INTO extended_preparations VALUES('run','b2b')")
        self.stage.execute("INSERT INTO extended_preparations VALUES('run','driver')")
        self.stage.commit()
        with self.assertRaises(ValueError):
            run_extended(self.stage, 'run', lambda: self.connection('other'), enabled=True)
        with self.assertRaises(ValueError):
            reconcile(self.stage, 'run', lambda: self.connection('other'))
        with self.assertRaises(ValueError):
            prepare(self.stage, 'run')
        with self.assertRaises(ValueError):
            prepare_extended(self.stage, 'run', 'driver', 'missing.csv')

    def test_reconciliation_requires_prepared_and_clears_confirmation_on_failure(self):
        target = bind_target(self.stage, 'run', self.connection())
        confirm(self.stage, 'run', 'citizens', target)
        self.stage.execute("INSERT INTO candidates VALUES('run','1','READY','[]','{}')")
        self.stage.commit()
        with self.assertRaises(ValueError):
            reconcile(self.stage, 'run', self.connection)
        self.assertEqual(self.stage.execute('SELECT count(*) FROM reconciliations').fetchone()[0], 0)
        self.stage.execute("UPDATE runs SET status='EXTRACTED'")
        self.stage.commit()
        with self.assertRaises(ValueError):
            reconcile(self.stage, 'run', self.connection)

    def test_empty_category_requires_explicit_preparation(self):
        with self.assertRaises(ValueError):
            require_extended(self.stage, 'run')
        for kind in ('b2b', 'driver'):
            self.stage.execute('INSERT INTO extended_preparations VALUES(?,?)', ('run',kind))
        self.stage.commit()
        require_extended(self.stage, 'run')
        self.stage.execute("INSERT INTO raw_rows VALUES('run','B2B','1','{}')")
        self.stage.commit()
        with self.assertRaises(ValueError):
            require_extended(self.stage, 'run')

    def test_committed_unit_without_local_checkpoint_cannot_change_target(self):
        from credentials import seal
        from cryptography.fernet import Fernet
        from test_credentials import fake_hash
        key = Fernet.generate_key()
        payload = json.dumps({'legacy_user_id': 1})
        self.stage.execute("INSERT INTO candidates VALUES('run','1','READY','[]',?)", (payload,))
        self.stage.execute("INSERT INTO sealed_credentials VALUES('run','1',?)", (seal(key, 'run', 1, fake_hash()),))
        self.stage.commit()
        real = self.stage

        class InterruptedCheckpoint:
            def execute(self, sql, parameters=()):
                if sql.lstrip().startswith('INSERT INTO load_results'):
                    raise OSError('Fixture interruption after destination commit')
                return real.execute(sql, parameters)
            def __enter__(self):
                real.__enter__(); return self
            def __exit__(self, *args):
                return real.__exit__(*args)

        with patch('loader.import_one', return_value=('IMPORTED', 'destination')) as unit:
            with self.assertRaises(OSError):
                load(InterruptedCheckpoint(), 'run', key, self.connection, enabled=True)
            unit.assert_called_once()
        self.assertIsNotNone(real.execute("SELECT target FROM run_targets WHERE run_id='run'").fetchone())
        self.assertEqual(real.execute('SELECT count(*) FROM load_results').fetchone()[0], 0)
        with patch('loader.import_one') as unit:
            with self.assertRaises(ValueError):
                load(real, 'run', key, lambda: self.connection('other'), enabled=True)
            unit.assert_not_called()
        with patch('loader.import_one', return_value=('ALREADY_IMPORTED', 'destination')):
            load(real, 'run', key, self.connection, enabled=True)
        self.assertEqual(real.execute('SELECT status FROM load_results').fetchone()[0], 'ALREADY_IMPORTED')
