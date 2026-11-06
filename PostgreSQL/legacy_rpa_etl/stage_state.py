"""Durable batch boundaries shared by citizen and complemented loading."""
import json
from datetime import datetime, timezone


def frozen(stage, run_id):
    return any(stage.execute('SELECT 1 FROM ' + table + ' WHERE run_id=? LIMIT 1', (run_id,)).fetchone()
               for table in ('run_targets', 'load_results', 'extended_results'))


def prepared(stage, run_id):
    row = stage.execute('SELECT source,status FROM runs WHERE id=?', (run_id,)).fetchone()
    if not row or row[1] != 'PREPARED':
        raise ValueError('Prepared snapshot required')
    return row[0]


def bind_target(stage, run_id, connection):
    prepared(stage, run_id)
    info = connection.get_dsn_parameters()
    target = json.dumps([info.get('host'), info.get('port'), info.get('dbname')])
    with stage:
        stage.execute('BEGIN IMMEDIATE')
        for table in ('load_results', 'extended_results'):
            if stage.execute('SELECT 1 FROM ' + table + ' WHERE run_id=? AND target<>? LIMIT 1',
                             (run_id, target)).fetchone():
                raise ValueError('Existing results belong to another destination')
        stage.execute('INSERT OR IGNORE INTO run_targets VALUES(?,?)', (run_id, target))
        if stage.execute('SELECT target FROM run_targets WHERE run_id=?', (run_id,)).fetchone() != (target,):
            raise ValueError('Batch destination is immutable')
    return target


def invalidate(stage, run_id, group):
    with stage:
        stage.execute('DELETE FROM reconciliations WHERE run_id=? AND group_name=?', (run_id, group))


def confirm(stage, run_id, group, target):
    with stage:
        stage.execute('INSERT INTO reconciliations VALUES(?,?,?,?) '
                      'ON CONFLICT(run_id,group_name) DO UPDATE SET target=excluded.target,confirmed_at=excluded.confirmed_at',
                      (run_id, group, target, datetime.now(timezone.utc).isoformat()))


def require_extended(stage, run_id):
    for kind, table in (('b2b', 'B2B'), ('driver', 'MOTORISTA')):
        if not stage.execute('SELECT 1 FROM extended_preparations WHERE run_id=? AND kind=?',
                             (run_id, kind)).fetchone():
            raise ValueError('Prepare both complement categories before extended loading')
        source = {row[0] for row in stage.execute('SELECT source_id FROM raw_rows WHERE run_id=? AND source_table=?', (run_id, table))}
        candidates = {row[0] for row in stage.execute('SELECT source_id FROM extended_candidates WHERE run_id=? AND kind=?', (run_id, kind))}
        if source != candidates:
            raise ValueError('Incomplete extended preparation')
