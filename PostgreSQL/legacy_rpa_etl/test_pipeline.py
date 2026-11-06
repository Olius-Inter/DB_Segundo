from test_file_policy import PathTestCase
import json
import tempfile
import unittest
from pathlib import Path

from pipeline import extract, open_stage, prepare, report


class SourceFixture:
    def __init__(self, fail_after=None):
        self.fail_after = fail_after
        self.tables = 0
        self.closed = False
        self.named_cursors = []

    def set_session(self, **options):
        if options != {'isolation_level': 'REPEATABLE READ', 'readonly': True}:
            raise AssertionError('Extraction must use a consistent read-only snapshot')

    def cursor(self, name=None):
        if name:
            self.named_cursors.append(name)
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, parameters=None):
        text = str(query)
        if 'information_schema.columns' in text:
            self.rows = [('ID',), ('senha',)]
        elif 'pg_constraint' in text:
            self.rows = [('ID',)]
        elif 'transaction_read_only' in text:
            self.rows = [('on',)]
        else:
            if "Identifier('senha')" in text:
                raise AssertionError('Credential column must not be selected')
            self.tables += 1
            if self.fail_after is not None and self.tables > self.fail_after:
                raise ConnectionError('Interrupted fixture')
            self.rows = [(1,)]

    def fetchone(self):
        return self.rows.pop(0)

    def fetchall(self):
        rows, self.rows = self.rows, []
        return rows

    def fetchmany(self, size):
        rows, self.rows = self.rows[:size], self.rows[size:]
        return rows

    def rollback(self):
        pass

    def close(self):
        self.closed = True


class StagingTests(PathTestCase):
    def setUp(self):
        super().setUp()
        self.directory = tempfile.TemporaryDirectory()
        self.stage = open_stage(Path(self.directory.name) / 'stage.sqlite')
        self.stage.execute("INSERT INTO runs VALUES ('test','2026-11-01','fixture','EXTRACTED')")
        self.user = dict(ID_usuario=1, nome='Pessoa de teste', email='teste@example.invalid',
                         telefone='11999999999', tipo_usuario='B2C', primeiro_registro='2025-01-01')
        self.add('USUARIO', 1, self.user)
        self.add('B2C', 1, dict(ID_B2C=1, ID_usuario=1, CPF='52998224725'))
        self.stage.commit()

    def add(self, table, key, value):
        self.stage.execute('INSERT INTO raw_rows VALUES (?,?,?,?)',
                           ('test', table, str(key), json.dumps(value)))

    def tearDown(self):
        self.stage.close()
        self.directory.cleanup()

    def test_valid_candidate_is_blocked_and_prepare_is_repeatable(self):
        prepare(self.stage, 'test')
        prepare(self.stage, 'test')
        self.assertEqual(report(self.stage, 'test')['candidate_counts'], {'BLOCKED_POLICY': 1})
        self.assertEqual(report(self.stage, 'test')['destination_writes'], 0)

    def test_encrypted_cpf_preparation_and_raw_preservation(self):
        import base64
        import os
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        key = AESGCM.generate_key(bit_length=256)
        def encrypt(cpf):
            nonce = os.urandom(12)
            return 'aesgcm$' + base64.b64encode(nonce).decode() + '$' + base64.b64encode(
                AESGCM(key).encrypt(nonce, cpf.encode(), None)).decode()
        def set_cpf(value):
            self.stage.execute("UPDATE raw_rows SET payload=? WHERE source_table='B2C'",
                               (json.dumps(dict(ID_B2C=1, ID_usuario=1, CPF=value)),))
        encrypted = encrypt('52998224725')
        set_cpf(encrypted)
        prepare(self.stage, 'test')
        self.assertIn('CPF_DECRYPTION_KEY_REQUIRED', self.stage.execute(
            'SELECT reasons FROM candidates').fetchone()[0])
        prepare(self.stage, 'test', key)
        payload = json.loads(self.stage.execute('SELECT payload FROM candidates').fetchone()[0])
        self.assertEqual(payload['cpf'], '52998224725')
        self.assertIn(encrypted, self.stage.execute(
            "SELECT payload FROM raw_rows WHERE source_table='B2C'").fetchone()[0])
        prepare(self.stage, 'test', AESGCM.generate_key(bit_length=256))
        self.assertIn('CPF_DECRYPTION_FAILED', self.stage.execute(
            'SELECT reasons FROM candidates').fetchone()[0])
        set_cpf(encrypt('11111111111'))
        prepare(self.stage, 'test', key)
        self.assertIn('INVALID_CPF_CHECK_DIGITS', self.stage.execute(
            'SELECT reasons FROM candidates').fetchone()[0])
        self.assertIsNone(json.loads(self.stage.execute(
            'SELECT payload FROM candidates').fetchone()[0])['cpf'])
        set_cpf(encrypted)
        self.add('B2C', 2, dict(ID_B2C=2, ID_usuario=2, CPF=encrypt('52998224725')))
        self.add('USUARIO', 2, dict(self.user, ID_usuario=2, email='other@example.invalid'))
        prepare(self.stage, 'test', key)
        self.assertTrue(all('DUPLICATE_IDENTITY' in row[0] for row in
                            self.stage.execute('SELECT reasons FROM candidates')))

    def test_cpf_key_and_malformed_documents(self):
        import base64
        from pipeline import read_cpf_key, decode_cpf
        path = Path(self.directory.name) / 'key.txt'
        path.write_text(base64.b64encode(bytes(32)).decode(), encoding='utf-8-sig')
        self.assertEqual(read_cpf_key(path), bytes(32))
        for value in ('invalid!', base64.b64encode(bytes(16)).decode()):
            path.write_text(value)
            with self.assertRaises(ValueError):
                read_cpf_key(path)
        for value in ('aesgcm$bad', 'aesgcm$bad$bad'):
            self.assertEqual(decode_cpf(value, bytes(32)), (None, 'CPF_DECRYPTION_FAILED'))
        self.assertEqual(decode_cpf(None, None), (None, 'INVALID_CPF_FORMAT'))
        self.assertEqual(decode_cpf('12345678901', None), (None, 'INVALID_CPF_CHECK_DIGITS'))

    def test_null_name_is_rejected_without_aborting_the_batch(self):
        self.stage.execute("UPDATE raw_rows SET payload=? WHERE source_table='USUARIO'",
                           (json.dumps(dict(self.user, nome=None)),))
        self.stage.commit()
        prepare(self.stage, 'test')
        row = self.stage.execute('SELECT status,reasons FROM candidates').fetchone()
        self.assertEqual(row[0], 'REJECTED')
        self.assertIn('INVALID_NAME', row[1])

    def test_missing_user_is_rejected(self):
        self.stage.execute("DELETE FROM raw_rows WHERE source_table='USUARIO'")
        prepare(self.stage, 'test')
        reasons = self.stage.execute('SELECT reasons FROM candidates').fetchone()[0]
        self.assertIn('MISSING_USER', reasons)

    def test_duplicate_email_is_rejected(self):
        self.add('USUARIO', 2, dict(self.user, ID_usuario=2))
        prepare(self.stage, 'test')
        self.assertEqual(report(self.stage, 'test')['candidate_counts'], {'REJECTED': 1})

    def test_failed_extraction_cannot_be_prepared(self):
        self.stage.execute("UPDATE runs SET status='FAILED'")
        with self.assertRaises(ValueError):
            prepare(self.stage, 'test')

    def test_retry_reuses_completed_snapshot_without_connecting(self):
        def must_not_connect():
            self.fail('Completed snapshot must not be extracted again')
        self.assertEqual(extract(self.stage, 'fixture', must_not_connect, 'test'), 'test')

    def test_retry_does_not_reuse_another_source(self):
        with self.assertRaises(ValueError):
            extract(self.stage, 'another-source', lambda: None, 'test')

    def test_connection_failure_records_failed_run_without_rows(self):
        def unavailable():
            raise ConnectionError('fixture')
        with self.assertRaises(ConnectionError):
            extract(self.stage, 'fixture', unavailable, 'failed-test')
        self.assertEqual(report(self.stage, 'failed-test')['status'], 'FAILED')
        self.assertEqual(report(self.stage, 'failed-test')['source_counts'], {})

    def test_complete_extraction_excludes_credentials(self):
        source = SourceFixture()
        extract(self.stage, 'fixture', lambda: source, 'snapshot')
        result = report(self.stage, 'snapshot')
        self.assertEqual(result['status'], 'EXTRACTED')
        self.assertEqual(sum(result['source_counts'].values()), 14)
        self.assertTrue(source.closed)
        self.assertEqual(len(source.named_cursors), 14)
        self.assertTrue(all('senha' not in row[0] for row in self.stage.execute(
            "SELECT payload FROM raw_rows WHERE run_id='snapshot'")))

    def test_interrupted_extraction_rolls_back_all_raw_rows(self):
        source = SourceFixture(fail_after=2)
        with self.assertRaises(ConnectionError):
            extract(self.stage, 'fixture', lambda: source, 'interrupted')
        self.assertEqual(report(self.stage, 'interrupted')['source_counts'], {})
        self.assertEqual(report(self.stage, 'interrupted')['status'], 'FAILED')
        self.assertTrue(source.closed)


if __name__ == '__main__':
    unittest.main()
