"""Constrain local file inputs to operator-configured roots, never CLI-provided roots."""
import os
from pathlib import Path

DEFAULTS = {'stage': '04_Preparacao_Demonstracao', 'key': '02_Chaves',
            'complement': '03_Complementacao_Cadastral'}


def checked_path(value, kind, *, must_exist=True):
    raw = os.fspath(value)
    if raw.startswith(('file:', ':memory:')) or '://' in raw or '\x00' in raw:
        raise ValueError('File URI or special filename not allowed')
    configured = os.environ.get('OLIUS_ETL_' + kind.upper() + '_ROOT')
    root = (Path(configured) if configured else Path.home() / 'OLIUS_Privado' / 'HistoricoLegado' / DEFAULTS[kind]).expanduser().resolve(strict=True)
    candidate = Path(raw).expanduser().resolve()
    if not candidate.is_relative_to(root) or candidate == root:
        raise ValueError('File outside the configured private root')
    if kind == 'stage' and candidate.suffix.lower() not in ('.sqlite', '.sqlite3', '.db'):
        raise ValueError('SQLite filename extension required')
    if kind == 'complement' and candidate.suffix.lower() != '.csv':
        raise ValueError('CSV filename extension required')
    if must_exist and not candidate.is_file():
        raise ValueError('Regular input file required')
    return candidate


def read_secret(path):
    path = checked_path(path, 'key')
    if path.stat().st_size > 4096:
        raise ValueError('Secret file too large')
    return path.read_bytes().strip()
