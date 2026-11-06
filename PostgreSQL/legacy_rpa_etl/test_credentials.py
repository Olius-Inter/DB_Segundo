from test_file_policy import PathTestCase
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.fernet import Fernet

from credentials import seal, store_credentials, unseal, valid_legacy
from pipeline import open_stage, prepare
from loader import load


def fake_hash():
    import base64
    salt = bytes(range(16))
    digest = hashlib.pbkdf2_hmac('sha256', b'fixture-only', salt, 120000, 32)
    return 'pbkdf2$120000$' + base64.b64encode(salt).decode() + '$' + base64.b64encode(digest).decode()


class CredentialTests(PathTestCase):
    def test_roundtrip_is_bound_to_run_and_identity(self):
        key = Fernet.generate_key()
        value = fake_hash()
        ciphertext = seal(key, 'run', 1, value)
        self.assertNotIn(value.encode(), ciphertext)
        self.assertEqual(unseal(key, 'run', 1, ciphertext), value)
        for run, user, secret in [('other', 1, key), ('run', 2, key),
                                  ('run', 1, Fernet.generate_key())]:
            with self.assertRaises(ValueError):
                unseal(secret, run, user, ciphertext)

    def test_invalid_formats_are_never_sealed(self):
        for value in [None, 'plaintext', '{noop}plaintext', fake_hash().replace('120000', '999999999'),
                      fake_hash() + 'extra']:
            self.assertFalse(valid_legacy(value))
            self.assertIsNone(seal(Fernet.generate_key(), 'run', 1, value))

    def test_protected_candidate_becomes_ready_without_hash_in_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            stage = open_stage(Path(folder) / 's.sqlite')
            try:
                stage.execute("INSERT INTO runs VALUES('run','2026-11-03','fixture','EXTRACTED')")
                for table, payload in [
                    ('USUARIO', dict(ID_usuario=1, nome='Fixture', email='x@example.invalid',
                                     telefone='11999999999', primeiro_registro='2025-01-01', tipo_usuario='B2C')),
                    ('B2C', dict(ID_B2C=1, ID_usuario=1, CPF='52998224725'))]:
                    stage.execute('INSERT INTO raw_rows VALUES(?,?,?,?)', ('run', table, '1', json.dumps(payload)))
                stage.execute('INSERT INTO sealed_credentials VALUES(?,?,?)',
                              ('run', '1', seal(Fernet.generate_key(), 'run', 1, fake_hash())))
                stage.commit()
                prepare(stage, 'run')
                status, payload = stage.execute('SELECT status,payload FROM candidates').fetchone()
                self.assertEqual(status, 'READY')
                self.assertNotIn('pbkdf2', payload)
                with self.assertRaises(ValueError):
                    load(stage, 'run', b'', lambda: self.fail('Disabled load connected'))
                stage.execute("DELETE FROM sealed_credentials WHERE run_id='run'")
                stage.execute("INSERT INTO credential_batches VALUES('run')")
                stage.commit()
                prepare(stage, 'run')
                self.assertEqual(stage.execute('SELECT status FROM candidates').fetchone()[0], 'REJECTED')
            finally:
                stage.close()


if __name__ == '__main__':
    unittest.main()
