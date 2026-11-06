from test_file_policy import PathTestCase
import csv
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from complements import FIELDS, main, validate_file


class ComplementTests(PathTestCase):
    def setUp(self):
        super().setUp()
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'private.csv'

    def write(self, kind, rows):
        with self.path.open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=FIELDS[kind], delimiter=';')
            writer.writeheader()
            writer.writerows(rows)

    def row(self, kind):
        common = dict(account_status='ACTIVE', confirmed_by='Fixture reviewer',
                      confirmed_at=date.today().isoformat())
        if kind == 'b2b':
            return dict(common, legacy_b2b_id='1', email='fixture@example.invalid',
                        establishment_type='Restaurante')
        return dict(common, legacy_driver_id='1', cpf='52998224725', cnh='01234567890')

    def test_empty_and_valid_files(self):
        for kind in FIELDS:
            self.write(kind, [])
            self.assertEqual(validate_file(self.path, kind)['status'], 'EMPTY')
            self.write(kind, [self.row(kind)])
            result = validate_file(self.path, kind)
            self.assertEqual(result['valid_rows'], 1)
            self.assertFalse(result['source_identity_verified'])
            self.assertEqual(result['destination_writes'], 0)
            self.assertTrue(validate_file(self.path, kind, {'1'})['source_identity_verified'])
            self.assertIn('SOURCE_ID_NOT_FOUND', validate_file(self.path, kind, {'2'})['reason_counts'])

    def test_invalid_and_duplicate_driver(self):
        row = dict(self.row('driver'), cpf='11111111111', cnh='123', legacy_driver_id='bad',
                   account_status='Ocupado', confirmed_by='', confirmed_at='invalid')
        self.write('driver', [row, row])
        result = validate_file(self.path, 'driver')
        self.assertEqual(result['rejected_rows'], 2)
        self.assertEqual(set(result['reason_counts']), {'INVALID_CPF', 'INVALID_CNH_FORMAT',
            'INVALID_SOURCE_ID', 'INVALID_ACCOUNT_STATUS', 'CONFIRMATION_REQUIRED',
            'INVALID_CONFIRMATION_DATE', 'DUPLICATE_SOURCE_ID', 'DUPLICATE_CPF', 'DUPLICATE_CNH'})

    def test_invalid_b2b_and_future_confirmation(self):
        row = dict(self.row('b2b'), email='invalid', establishment_type='unknown',
                   confirmed_at=(date.today() + timedelta(days=1)).isoformat())
        self.write('b2b', [row, row])
        self.assertEqual(validate_file(self.path, 'b2b')['rejected_rows'], 2)
        result = validate_file(self.path, 'b2b')['reason_counts']
        self.assertIn('INVALID_EMAIL', result)
        self.assertIn('DUPLICATE_EMAIL', result)
        self.assertIn('INVALID_ESTABLISHMENT_TYPE', result)

    def test_malformed_files_and_cli_do_not_expose_values(self):
        self.path.write_text('PRIVATE_HEADER', encoding='utf-8')
        with self.assertRaises(ValueError):
            validate_file(self.path, 'b2b')
        with patch('sys.argv', ['complements', '--kind', 'b2b', '--file', str(self.path)]), \
             redirect_stdout(io.StringIO()) as output:
            self.assertEqual(main(), 1)
        self.assertNotIn('PRIVATE_HEADER', output.getvalue())
        self.write('driver', [self.row('driver')])
        with patch('sys.argv', ['complements', '--kind', 'driver', '--file', str(self.path)]), \
             redirect_stdout(io.StringIO()) as output:
            self.assertEqual(main(), 0)
        result = json.loads(output.getvalue())
        self.assertEqual(result['status'], 'FIELDS_VALID')
        self.assertNotIn('52998224725', output.getvalue())
        with self.path.open('a') as stream:
            stream.write('too;few\n')
        with self.assertRaises(ValueError):
            validate_file(self.path, 'driver')


if __name__ == '__main__':
    unittest.main()
