"""Encrypted history and aggregate public report; never connects to PostgreSQL."""
import argparse
from collections import Counter
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import sqlite3
import os
import tempfile
from file_policy import checked_path, read_secret
import uuid

from cryptography.fernet import Fernet

SECRET_FIELDS = {'senha', 'password', 'password_hash', 'token', 'token_hash',
                 'qr_token', 'refresh_token', 'access_token', 'cpf_chave'}


def sanitize(value):
    if isinstance(value, dict):
        return {key: sanitize(item) for key, item in value.items()
                if key.casefold() not in SECRET_FIELDS}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def history(stage, run_id, version, evaluation_date=None):
    run = stage.execute('SELECT started_at,source,status FROM runs WHERE id=?', (run_id,)).fetchone()
    if not run or run[2] != 'PREPARED':
        raise ValueError('Only a prepared snapshot can be archived')
    imported_citizens, imported_users = set(), set()
    for raw in stage.execute('''SELECT c.payload FROM candidates c
        JOIN load_results r USING(run_id,source_id)
        JOIN run_targets t ON t.run_id=c.run_id AND t.target=r.target
        JOIN reconciliations q ON q.run_id=t.run_id AND q.target=t.target AND q.group_name='citizens'
        WHERE c.run_id=? AND r.status IN ('IMPORTED','ALREADY_IMPORTED')''', (run_id,)):
        candidate = json.loads(raw[0])
        imported_citizens.add(str(candidate['legacy_citizen_id']))
        imported_users.add(str(candidate['legacy_user_id']))
    imported_extended = set(stage.execute("SELECT r.kind,r.source_id FROM extended_results r "
        "JOIN run_targets t ON t.run_id=r.run_id AND t.target=r.target "
        "JOIN reconciliations q ON q.run_id=t.run_id AND q.target=t.target AND q.group_name='extended' "
        "WHERE r.run_id=? AND r.status IN ('IMPORTED','ALREADY_IMPORTED')", (run_id,)))
    items = []
    counts = Counter()
    for table, source_id, raw in stage.execute('''SELECT source_table,source_id,payload
        FROM raw_rows WHERE run_id=? ORDER BY source_table,source_id''', (run_id,)):
        if table == 'B2C' and source_id in imported_citizens:
            continue
        payload = sanitize(json.loads(raw))
        reason = 'NOT_IMPORTED_OR_NO_APPROVED_OPERATIONAL_MAPPING'
        kind = {'B2B': 'b2b', 'MOTORISTA': 'driver'}.get(table)
        if (kind, source_id) in imported_extended:
            # Plano, empresa_resp, telefone and other unmapped facts still need preservation.
            reason = 'CADASTRO_IMPORTED_WITH_UNMAPPED_LEGACY_FIELDS'
        if table == 'USUARIO' and source_id in imported_users:
            # Citizens have no personal address in the new model. Preserve this
            # otherwise-lost link without duplicating the imported account profile.
            if payload.get('ID_endereco') is None:
                continue
            payload = {'ID_usuario': payload['ID_usuario'], 'ID_endereco': payload['ID_endereco']}
            reason = 'LEGACY_ADDRESS_REFERENCE_NOT_MAPPED'
        items.append({'source_table': table, 'source_id': source_id, 'original_data': payload,
                      'reason': reason})
        counts[table] += 1
    deadline = str(date.fromisoformat(evaluation_date) + timedelta(days=90)) if evaluation_date else None
    private = {'format_version': 1, 'run_id': run_id, 'archive_version': version,
               'extracted_at': run[0], 'source_system': run[1],
               'retention_deadline': deadline, 'records': items,
               'notice': 'Historical evidence only; not valid app operations or points. '
                         'Encrypted source CPF values remain encrypted; decryption requires the original key kept separately.'}
    # No raw identifiers, source host, payloads, names, emails, CPF or credentials.
    public = {'format_version': 1, 'run_id': run_id, 'archive_version': version,
              'retention_deadline': deadline, 'historical_records': len(items),
              'records_by_table': dict(sorted(counts.items())),
              'notice': 'Aggregate report only. Preservation does not grant points or validate operations.'}
    return private, public


def inside(path, directory):
    return path == directory or directory in path.parents


def put_once(path, data):
    """Publish a complete, fsynced file atomically without overwriting another version."""
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError('Existing output differs; create a reviewed new version')
        return
    descriptor, temporary = tempfile.mkstemp(prefix='.olius-pending-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            if os.name == 'nt':
                os.rename(temporary, path)  # Windows rename refuses an existing destination.
            else:
                os.link(temporary, path)  # Atomic create-if-absent on the same filesystem.
        except FileExistsError:
            if path.read_bytes() != data:
                raise ValueError('Concurrent output differs; review a new version') from None
    finally:
        Path(temporary).unlink(missing_ok=True)


def export_history(stage, run_id, version, key_file, encrypted_dir, backup_dir, report_dir,
                   evaluation_date=None):
    run_id = str(uuid.UUID(run_id))
    if not isinstance(version, int) or version < 1:
        raise ValueError('Positive archive version required')
    paths = [Path(item).resolve() for item in (encrypted_dir, backup_dir, report_dir)]
    key_file = checked_path(key_file, 'key')
    databases = [Path(row[2]).resolve() for row in stage.execute('PRAGMA database_list') if row[2]]
    if any(inside(database, path) for database in databases for path in paths):
        raise ValueError('Staging must remain outside all archive and report directories')
    for i, path in enumerate(paths):
        if inside(key_file, path):
            raise ValueError('Keep the key separate from archive, backup and shared report')
        for other in paths[i + 1:]:
            if inside(path, other) or inside(other, path):
                raise ValueError('Archive, backup and report require separate locations')
    private, public = history(stage, run_id, version, evaluation_date)
    plaintext = json.dumps(private, ensure_ascii=False, sort_keys=True).encode()
    cipher = Fernet(read_secret(key_file))
    encrypted_dir, backup_dir, report_dir = paths
    for path in paths:
        path.mkdir(parents=True, exist_ok=True)
    name = f'legacy-{run_id}-v{version}'
    original = encrypted_dir / (name + '.json.fernet')
    if original.exists():
        ciphertext = original.read_bytes()
        if cipher.decrypt(ciphertext) != plaintext:
            raise ValueError('History changed; create a reviewed new archive version')
    else:
        ciphertext = cipher.encrypt(plaintext)
        put_once(original, ciphertext)
    digest = hashlib.sha256(ciphertext).hexdigest()
    backup = backup_dir / original.name
    put_once(backup, ciphertext)
    if hashlib.sha256(backup.read_bytes()).hexdigest() != digest:
        raise ValueError('Backup checksum mismatch')
    if cipher.decrypt(backup.read_bytes()) != plaintext:
        raise ValueError('Backup recovery verification failed')
    # This public manifest contains only aggregate counts and the encrypted-file digest.
    public.update(encrypted_sha256=digest, local_backup_verified=True,
                  cloud_sync_verified=False, key_recovery_with_caio_verified=False)
    report = json.dumps(public, ensure_ascii=False, indent=2, sort_keys=True).encode()
    # Report is last: its existence means both ciphertext copies were verified locally.
    put_once(report_dir / (name + '-report.json'), report)
    put_once(encrypted_dir / (name + '-manifest.json'), report)
    return public


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('stage', 'run-id', 'key-file', 'encrypted-dir', 'backup-dir', 'report-dir'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--version', type=int, default=1)
    parser.add_argument('--evaluation-date', help='YYYY-MM-DD; absent means retention date pending')
    args = parser.parse_args()
    stage = None
    try:
        # Read-only staging: archive generation never changes extraction/load state.
        stage = sqlite3.connect(checked_path(args.stage, 'stage').as_uri() + '?mode=ro', uri=True)
        stage.execute('BEGIN')
        with stage:
            result = export_history(stage, args.run_id, args.version, args.key_file,
                                    args.encrypted_dir, args.backup_dir, args.report_dir,
                                    args.evaluation_date)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({'status': 'FAILED', 'error_type': type(exc).__name__}))
        raise SystemExit(1) from None
    finally:
        if stage is not None:
            stage.close()


if __name__ == '__main__':
    main()
