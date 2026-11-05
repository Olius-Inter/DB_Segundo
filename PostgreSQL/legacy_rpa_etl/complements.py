"""Validate private complement CSVs without printing or storing personal data."""
import argparse
import csv
import json
from collections import Counter
from datetime import date

from pipeline import decode_cpf

CATEGORIES = frozenset(('Restaurante', 'Lanchonete', 'Padaria e confeitaria', 'Bar',
                        'Hotel e pousada', 'Cozinha institucional', 'Outro'))
COMMON = ('account_status', 'confirmed_by', 'confirmed_at')
FIELDS = {'b2b': ('legacy_b2b_id', 'email', 'establishment_type') + COMMON,
          'driver': ('legacy_driver_id', 'cpf', 'cnh') + COMMON}


def read_records(path, kind):
    """Private values are returned only to the local preparation process."""
    fields = FIELDS[kind]
    records = []
    with open(path, encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream, delimiter=';', strict=True)
        if reader.fieldnames != list(fields):
            raise ValueError('Unexpected complement CSV header')
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise ValueError('Unexpected complement CSV column count')
            records.append({name: value.strip() for name, value in row.items()})
    return records


def validate_file(path, kind, source_ids=None):
    """Report eligibility for review only; source_ids comes from a trusted snapshot.

    No source lookup or destination write occurs here. Without source_ids, identity
    correspondence is explicitly unverified even when CSV fields are valid.
    """
    return validate_records(read_records(path, kind), kind, source_ids)


def validate_records(records, kind, source_ids=None):
    fields = FIELDS[kind]
    reasons = Counter()
    id_field = fields[0]
    ids = Counter(row[id_field] for row in records)
    emails = Counter(row['email'].rsplit('@', 1)[0] + '@' + row['email'].rsplit('@', 1)[-1].lower()
                     for row in records) if kind == 'b2b' else Counter()
    cpfs = Counter(row['cpf'] for row in records) if kind == 'driver' else Counter()
    cnhs = Counter(row['cnh'] for row in records) if kind == 'driver' else Counter()
    valid_rows = 0
    for row in records:
        errors = set()
        identity = row[id_field]
        if not identity or not identity.isascii() or not identity.isdigit():
            errors.add('INVALID_SOURCE_ID')
        elif source_ids is not None and identity not in source_ids:
            errors.add('SOURCE_ID_NOT_FOUND')
        if ids[identity] > 1:
            errors.add('DUPLICATE_SOURCE_ID')
        if row['account_status'] not in ('ACTIVE', 'INACTIVE'):
            errors.add('INVALID_ACCOUNT_STATUS')
        if not row['confirmed_by']:
            errors.add('CONFIRMATION_REQUIRED')
        try:
            confirmed = date.fromisoformat(row['confirmed_at'])
            if confirmed.isoformat() != row['confirmed_at'] or confirmed > date.today():
                raise ValueError()
        except ValueError:
            errors.add('INVALID_CONFIRMATION_DATE')
        if kind == 'b2b':
            email = row['email']
            if (email.count('@') != 1 or not all(email.split('@')) or len(email) > 255
                    or any(char.isspace() for char in email)):
                errors.add('INVALID_EMAIL')
            email_key = email.rsplit('@', 1)[0] + '@' + email.rsplit('@', 1)[-1].lower()
            if emails[email_key] > 1:
                errors.add('DUPLICATE_EMAIL')
            if row['establishment_type'] not in CATEGORIES:
                errors.add('INVALID_ESTABLISHMENT_TYPE')
        else:
            if decode_cpf(row['cpf'], None)[1] is not None:
                errors.add('INVALID_CPF')
            cnh = row['cnh']
            if not (cnh.isascii() and cnh.isdigit() and len(cnh) == 11):
                errors.add('INVALID_CNH_FORMAT')
            if cpfs[row['cpf']] > 1:
                errors.add('DUPLICATE_CPF')
            if cnhs[cnh] > 1:
                errors.add('DUPLICATE_CNH')
        reasons.update(errors)
        valid_rows += not errors
    return dict(kind=kind, total=len(records), valid_rows=valid_rows,
                rejected_rows=len(records) - valid_rows, reason_counts=dict(reasons),
                source_identity_verified=source_ids is not None,
                status='EMPTY' if not records else ('REVIEW_REQUIRED' if reasons else 'FIELDS_VALID'),
                destination_writes=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kind', choices=tuple(FIELDS), required=True)
    parser.add_argument('--file', required=True)
    args = parser.parse_args()
    try:
        result = validate_file(args.file, args.kind)
        print(json.dumps(result))
        return 0 if result['total'] and not result['rejected_rows'] else 1
    except (OSError, ValueError, csv.Error, UnicodeError) as exc:
        # Paths, CSV values and parser exception messages may contain personal data.
        print(json.dumps(dict(status='FAILED', error_type=type(exc).__name__)))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
