from test_file_policy import PathTestCase
import csv
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from complements import FIELDS
from extended import (prepare_extended, run_extended, import_extended, extended_report,
                      password_without_known_owner, ImportConflict)
from pipeline import open_stage


def fixture(stage, folder, kind, identity='1'):
    common = dict(account_status='ACTIVE', confirmed_by='Fixture reviewer', confirmed_at='2026-01-01')
    if kind == 'b2b':
        source = dict(ID_B2B=1, CNPJ='11222333000181', ID_endereco=1,
                      nome_empresa='Fixture business', telefone='11999999999', ID_usuario=None)
        row = dict(common, legacy_b2b_id=identity, email='business@example.invalid', establishment_type='Restaurante')
        address = dict(ID_endereco=1, rua='Fixture street', cidade='Fixture city', bairro='Fixture area',
                       cep='01001000', numero='1', complemento=None, estado='SP')
        stage.execute('INSERT INTO raw_rows VALUES(?,?,?,?)', ('run', 'ENDERECO', '1', json.dumps(address)))
        table = 'B2B'
    else:
        source = dict(ID_motorista=1, nome='Fixture driver', status='Ocupado')
        row = dict(common, legacy_driver_id=identity, cpf='11144477735', cnh='01234567890')
        table = 'MOTORISTA'
    stage.execute('INSERT INTO raw_rows VALUES(?,?,?,?)', ('run', table, '1', json.dumps(source)))
    stage.commit()
    path = Path(folder) / (kind + '.csv')
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS[kind], delimiter=';')
        writer.writeheader()
        writer.writerow(row)
    return path


class ExtendedTests(PathTestCase):
    def setUp(self):
        super().setUp()
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.stage = open_stage(Path(self.folder.name) / 'stage.sqlite')
        self.addCleanup(self.stage.close)
        self.stage.execute("INSERT INTO runs VALUES('run','2026-01-01','fixture-extended','PREPARED')")
        self.stage.commit()

    def test_prepare_valid_and_guard_repreparation(self):
        for kind in ('b2b', 'driver'):
            path = fixture(self.stage, self.folder.name, kind)
            self.assertEqual(prepare_extended(self.stage, 'run', kind, path)['candidate_counts'], {'READY': 1})
        serialized = '\n'.join(self.stage.iterdump())
        self.assertNotIn('argon2', serialized)
        self.stage.execute("INSERT INTO extended_results VALUES('run','driver','1','CONFLICT',NULL,'target')")
        self.stage.commit()
        with self.assertRaises(ValueError):
            prepare_extended(self.stage, 'run', 'driver', path)
        with self.assertRaises(ValueError):
            run_extended(self.stage, 'run', lambda: None)
        with self.assertRaises(ValueError):
            run_extended(self.stage, 'missing', lambda: None, enabled=True)

    def test_empty_complements_and_malformed_source(self):
        path = fixture(self.stage, self.folder.name, 'b2b')
        self.stage.execute("UPDATE runs SET status='EXTRACTED'")
        self.stage.commit()
        with self.assertRaises(ValueError):
            prepare_extended(self.stage, 'run', 'b2b', path)
        self.stage.execute("UPDATE runs SET status='PREPARED'")
        self.stage.execute("UPDATE raw_rows SET payload=? WHERE source_table='B2B'",
                           (json.dumps(dict(nome_empresa='', CNPJ='x', telefone='', ID_endereco=None,
                                            ID_usuario=5)),))
        self.stage.commit()
        prepare_extended(self.stage, 'run', 'b2b', path)
        reasons = json.loads(self.stage.execute('SELECT reasons FROM extended_candidates').fetchone()[0])
        self.assertEqual(set(reasons), {'INVALID_NAME', 'INVALID_CNPJ_FORMAT', 'INVALID_PHONE',
                                       'ADDRESS_REQUIRED', 'LINKED_LEGACY_ACCOUNT_REQUIRES_REVIEW'})
        path.write_text(';'.join(FIELDS['b2b']) + '\n')
        prepare_extended(self.stage, 'run', 'b2b', path)
        self.assertIn('COMPLEMENT_REQUIRED', self.stage.execute('SELECT reasons FROM extended_candidates').fetchone()[0])

    def test_cnpj_accepts_only_digits_or_the_standard_mask(self):
        path = fixture(self.stage, self.folder.name, 'b2b')
        for cnpj, expected in [('11.222.333/0001-81', 'READY'), ('x11222333000181', 'REJECTED')]:
            raw = self.stage.execute("SELECT payload FROM raw_rows WHERE source_table='B2B'").fetchone()[0]
            payload = json.loads(raw); payload['CNPJ'] = cnpj
            self.stage.execute("UPDATE raw_rows SET payload=? WHERE source_table='B2B'", (json.dumps(payload),))
            self.stage.commit()
            prepare_extended(self.stage, 'run', 'b2b', path)
            self.assertEqual(self.stage.execute('SELECT status FROM extended_candidates').fetchone()[0], expected)

    def test_invalid_address_and_unknown_complement(self):
        path = fixture(self.stage, self.folder.name, 'b2b', identity='2')
        with self.assertRaises(ValueError):
            prepare_extended(self.stage, 'run', 'b2b', path)
        path.write_text(path.read_text(encoding='utf-8-sig').replace('2;', '1;', 1), encoding='utf-8')
        self.stage.execute("UPDATE raw_rows SET payload='{}' WHERE source_table='ENDERECO'")
        self.stage.commit()
        prepare_extended(self.stage, 'run', 'b2b', path)
        self.assertIn('INVALID_ADDRESS', self.stage.execute('SELECT reasons FROM extended_candidates').fetchone()[0])

    def test_bootstrap_hash_is_random_and_core_compatible(self):
        first, second = password_without_known_owner(), password_without_known_owner()
        self.assertTrue(first.startswith('$argon2id$v=19$m=19456,t=2,p=1$'))
        self.assertNotEqual(first, second)


def exercise_destination(connect):
    """Invoked only by the disposable PostgreSQL integration harness."""
    with tempfile.TemporaryDirectory() as folder:
        stage = open_stage(Path(folder) / 'stage.sqlite')
        try:
            run_id = str(uuid.uuid4())
            stage.execute("INSERT INTO runs VALUES('run','2026-01-01','fixture-extended','PREPARED')")
            for kind in ('b2b', 'driver'):
                path = fixture(stage, folder, kind)
                prepare_extended(stage, 'run', kind, path)
            # The runtime requires a real UUID for durable provenance.
            stage.execute('INSERT INTO runs SELECT ?,started_at,source,status FROM runs WHERE id=?', (run_id, 'run'))
            for table in ('raw_rows', 'extended_candidates', 'extended_preparations'):
                stage.execute('UPDATE ' + table + ' SET run_id=?', (run_id,))
            stage.commit()
            connection = connect()
            try:
                with connection:
                    with connection.cursor() as q:
                        q.execute("INSERT INTO establishment_type(name) VALUES('Restaurante')")
                run_extended(stage, run_id, connect, enabled=True)
                assert all(extended_report(stage, run_id, kind)['load_counts'] == {'IMPORTED': 1}
                           for kind in ('b2b', 'driver'))
                run_extended(stage, run_id, connect, enabled=True, reconcile_only=True)
                with connection:
                    with connection.cursor() as q:
                        q.execute("SELECT destination_id FROM olius_etl.establishment_import WHERE source_system='fixture-extended'")
                        uid = str(q.fetchone()[0])
                        q.execute("SELECT password_hash FROM users WHERE id=%s", (uid,))
                        assert q.fetchone()[0].startswith('$argon2id$v=19$m=19456,t=2,p=1$')
                        q.execute("UPDATE users SET password_hash='app-defined-new-hash',status='INACTIVE' WHERE id=%s", (uid,))
                run_extended(stage, run_id, connect, enabled=True)
                with connection:
                    with connection.cursor() as q:
                        q.execute('SELECT password_hash,status FROM users WHERE id=%s', (uid,))
                        assert q.fetchone() == ('app-defined-new-hash', 'INACTIVE')
                        q.execute('SELECT count(*) FROM establishment_subscription')
                        assert q.fetchone()[0] == 0
                assert all(extended_report(stage, run_id, kind)['load_counts'] == {'ALREADY_IMPORTED': 1}
                           for kind in ('b2b', 'driver'))
                payload = json.loads(stage.execute("SELECT payload FROM extended_candidates WHERE kind='b2b'").fetchone()[0])
                for changed in (dict(payload, name='Source changed'), dict(payload, source_id='2')):
                    try:
                        import_extended(connection, 'fixture-extended', run_id, 'b2b', changed)
                    except ImportConflict:
                        pass
                    else:
                        raise AssertionError('Expected source or identity conflict')
                rollback = dict(payload, source_id='rollback', email='rollback-business@example.invalid', cnpj='22333444000181')
                def fail(q):
                    q.execute('SELECT 1/0')
                try:
                    import_extended(connection, 'fixture-extended', run_id, 'b2b', rollback, fail)
                except Exception:
                    pass
                else:
                    raise AssertionError('Expected rollback')
                with connection:
                    with connection.cursor() as q:
                        q.execute("SELECT count(*) FROM users WHERE email='rollback-business@example.invalid'")
                        assert q.fetchone()[0] == 0
                # Reported source conflict must fail reconciliation rather than claim completion.
                stage.execute("UPDATE extended_candidates SET payload=? WHERE kind='b2b'",
                              (json.dumps(dict(payload, name='changed')),))
                stage.commit()
                run_extended(stage, run_id, connect, enabled=True)
                try:
                    run_extended(stage, run_id, connect, enabled=True, reconcile_only=True)
                except ValueError:
                    pass
                else:
                    raise AssertionError('Expected unresolved conflict')
            finally:
                connection.close()
        finally:
            stage.close()


if __name__ == '__main__':
    unittest.main()
