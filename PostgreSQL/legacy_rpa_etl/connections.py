"""Explicit TLS destination configuration; never falls back to the legacy DB."""
import os
import shutil
import tempfile

import psycopg2


def destination_connection():
    values = {key: os.environ['OLIUS_TARGET_' + name] for key, name in
              [('host', 'HOST'), ('port', 'PORT'), ('dbname', 'DATABASE'), ('user', 'USER'),
               ('sslrootcert', 'CA'), ('passfile', 'PGPASS')]}
    target = values['host'] + ':' + values['port'] + '/' + values['dbname']
    if os.environ.get('OLIUS_ETL_CONFIRMED_TARGET') != target:
        raise ValueError('Confirm the explicit destination before connecting')
    if (values['host'], values['port'], values['dbname']) == (
            os.environ.get('OLIUS_LEGACY_HOST'), os.environ.get('OLIUS_LEGACY_PORT'),
            os.environ.get('OLIUS_LEGACY_DATABASE')):
        raise ValueError('Legacy cannot be the destination')
    with tempfile.TemporaryDirectory(prefix='olius-target-passfile-') as folder:
        passfile = os.path.join(folder, 'pgpass.conf')
        shutil.copyfile(values['passfile'], passfile)
        os.chmod(passfile, 0o600)
        values['passfile'] = passfile
        return psycopg2.connect(**values, sslmode='verify-full', connect_timeout=15,
                               application_name='olius_legacy_loader')
