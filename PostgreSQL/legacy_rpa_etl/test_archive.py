import json
from pathlib import Path
import tempfile
import unittest
import uuid
import io
from contextlib import redirect_stdout
from unittest.mock import patch

from cryptography.fernet import Fernet

from archive import export_history, main
from pipeline import open_stage


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.stage = open_stage(self.root / 's.sqlite')
        self.run = str(uuid.uuid4())
        self.stage.execute('INSERT INTO runs VALUES(?,?,?,?)',
                           (self.run, '2026-11-03', 'fixture-host/private-db', 'PREPARED'))
        for table, key, payload in [('USUARIO', '1', {'email': 'personal@example.invalid', 'senha': 'SECRET'}),
                                    ('B2C', '1', {'CPF': 'aesgcm$original-ciphertext'}),
                                    ('COLETA', '9', {'volume_coletado': '10.50', 'token_hash': 'SECRET'})]:
            self.stage.execute('INSERT INTO raw_rows VALUES(?,?,?,?)',
                               (self.run, table, key, json.dumps(payload)))
        self.stage.commit()
        self.key = self.root / 'key'
        self.key.write_bytes(Fernet.generate_key())

    def tearDown(self):
        self.stage.close()
        self.temp.cleanup()

    def export(self, version=1, **options):
        return export_history(self.stage, self.run, version, self.key,
                              self.root / 'private', self.root / 'backup', self.root / 'shared', **options)

    def test_encryption_backup_public_report_and_retention(self):
        result = self.export(evaluation_date='2026-12-01')
        self.assertEqual(result['retention_deadline'], '2027-03-01')
        a = next((self.root / 'private').glob('*.fernet'))
        b = next((self.root / 'backup').glob('*.fernet'))
        self.assertEqual(a.read_bytes(), b.read_bytes())
        private = Fernet(self.key.read_bytes()).decrypt(a.read_bytes()).decode()
        self.assertIn('personal@example.invalid', private)
        self.assertIn('aesgcm$original-ciphertext', private)
        self.assertNotIn('SECRET', private)
        public = next((self.root / 'shared').glob('*.json')).read_text(encoding='utf-8')
        for forbidden in ('personal@example.invalid', 'original-ciphertext', 'fixture-host', 'SECRET', 'source_id'):
            self.assertNotIn(forbidden, public)
        self.assertTrue(result['local_backup_verified'])
        self.assertFalse(result['cloud_sync_verified'])

    def test_rerun_does_not_reencrypt_or_overwrite(self):
        first = self.export()
        self.assertEqual(first, self.export())

    def test_changed_snapshot_requires_new_version(self):
        self.export()
        self.stage.execute("UPDATE raw_rows SET payload='{}' WHERE source_table='COLETA'")
        self.stage.commit()
        with self.assertRaises(ValueError):
            self.export()
        self.export(version=2)

    def test_corrupt_backup_is_not_replaced_silently(self):
        self.export()
        next((self.root / 'backup').glob('*.fernet')).write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            self.export()

    def test_shared_folder_cannot_contain_key(self):
        with self.assertRaises(ValueError):
            export_history(self.stage, self.run, 1, self.key,
                           self.root / 'private', self.root / 'backup', self.root)

    def test_confirmed_citizen_is_excluded_but_other_history_remains(self):
        self.stage.execute('INSERT INTO candidates VALUES(?,?,?,?,?)',
                           (self.run, '1', 'READY', '[]',
                            json.dumps({'legacy_user_id': 1, 'legacy_citizen_id': 1})))
        self.stage.execute('INSERT INTO load_results VALUES(?,?,?,?,?)',
                           (self.run, '1', 'IMPORTED', str(uuid.uuid4()), 'fixture'))
        self.stage.commit()
        result = self.export()
        self.assertEqual(result['records_by_table'], {'COLETA': 1})

    def test_imported_account_keeps_unmapped_address_link_without_profile(self):
        self.stage.execute("UPDATE raw_rows SET payload=? WHERE source_table='USUARIO'",
                           (json.dumps({'ID_usuario': 1, 'ID_endereco': 4,
                                        'email': 'personal@example.invalid'}),))
        self.stage.execute('INSERT INTO candidates VALUES(?,?,?,?,?)',
                           (self.run, '1', 'READY', '[]',
                            json.dumps({'legacy_user_id': 1, 'legacy_citizen_id': 1})))
        self.stage.execute('INSERT INTO load_results VALUES(?,?,?,?,?)',
                           (self.run, '1', 'IMPORTED', str(uuid.uuid4()), 'fixture'))
        self.stage.commit()
        self.export()
        path = next((self.root / 'private').glob('*.fernet'))
        data = json.loads(Fernet(self.key.read_bytes()).decrypt(path.read_bytes()))
        account = next(item for item in data['records'] if item['source_table'] == 'USUARIO')
        self.assertEqual(account['original_data'], {'ID_usuario': 1, 'ID_endereco': 4})

    def test_cli_outputs_only_aggregates_and_handles_failure(self):
        arguments = ['archive', '--stage', str(self.root / 's.sqlite'), '--run-id', self.run,
                     '--key-file', str(self.key), '--encrypted-dir', str(self.root / 'private'),
                     '--backup-dir', str(self.root / 'backup'), '--report-dir', str(self.root / 'shared')]
        with patch('sys.argv', arguments), redirect_stdout(io.StringIO()) as output:
            main()
        self.assertEqual(json.loads(output.getvalue())['historical_records'], 3)
        self.assertNotIn('personal@example.invalid', output.getvalue())
        self.key.write_bytes(Fernet.generate_key())
        with patch('sys.argv', arguments), redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(SystemExit):
                main()
        self.assertEqual(json.loads(output.getvalue())['status'], 'FAILED')


if __name__ == '__main__':
    unittest.main()
