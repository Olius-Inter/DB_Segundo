"""Negative ACL cases against an explicitly disposable SQL CI database."""
import os
import subprocess

import run_ci

SIGNATURE = 'public.schedule_collection_request_once(uuid,timestamptz,timestamptz,uuid,text,uuid)'
CLONE = 'olius_schedule_acl_test'


def execute(sql=None, *, database=None, file=None, expected_error=None):
    args = run_ci.command() + ['-qAt', '-v', 'VERBOSITY=verbose']
    if database:
        if '-d' in args:
            args[args.index('-d') + 1] = database
        else:
            args += ['-d', database]
    if file:
        path = '/workspace/' + file if os.environ.get('OLIUS_TEST_DOCKER_CONTAINER') else str(run_ci.ROOT / file)
        args += ['-f', path]
    result = subprocess.run(args, input=sql, text=True, encoding='utf-8', capture_output=True,
                            timeout=90, cwd=run_ci.ROOT)
    if expected_error:
        if result.returncode == 0 or expected_error not in result.stderr:
            raise AssertionError('Expected ACL rejection: ' + result.stderr[-1200:])
    elif result.returncode:
        raise RuntimeError(result.stderr[-1600:])
    return result.stdout.strip()


def main():
    if os.environ.get('OLIUS_CI_DISPOSABLE') != '1':
        raise RuntimeError('Disposable SQL CI database required')
    source = execute('SELECT current_database();')
    if execute("SELECT has_function_privilege('olius_reader','" + SIGNATURE + "','EXECUTE');") != 'f':
        raise AssertionError('Unsafe initial ACL')
    execute('GRANT EXECUTE ON PROCEDURE ' + SIGNATURE + ' TO olius_reader;')
    try:
        execute(file='PostgreSQL/access_control/01_roles.sql', expected_error='42501')
    finally:
        execute('REVOKE EXECUTE ON PROCEDURE ' + SIGNATURE + ' FROM olius_reader;')
    execute(file='PostgreSQL/access_control/01_roles.sql')
    if execute("SELECT has_function_privilege('olius_api','" + SIGNATURE + "','EXECUTE') "
               "AND NOT has_function_privilege('olius_reader','" + SIGNATURE + "','EXECUTE');") != 't':
        raise AssertionError('Authorized and forbidden roles diverged after review')

    # Clone only the disposable database, connecting elsewhere to avoid locking its template.
    maintenance = 'template1' if source != 'template1' else 'postgres'
    if execute("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='" + CLONE + "');",
               database=maintenance) != 'f':
        raise RuntimeError('Review database already exists; it will not be reused')
    created = False
    try:
        source_identifier = '"' + source.replace('"', '""') + '"'
        execute('CREATE DATABASE ' + CLONE + ' TEMPLATE ' + source_identifier + ';', database=maintenance)
        created = True
        execute("DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.collection_schedule_command) THEN "
                "RAISE EXCEPTION 'Review requires empty commands'; END IF; END $$; "
                'DELETE FROM public.data_catalog_column WHERE table_catalog_id IN '
                "(SELECT id FROM public.data_catalog_table WHERE table_name='collection_schedule_command' AND schema_name='public'); "
                "DELETE FROM public.data_catalog_table WHERE table_name='collection_schedule_command' AND schema_name='public'; "
                'DROP PROCEDURE ' + SIGNATURE + '; DROP TABLE public.collection_schedule_command; '
                'ALTER DEFAULT PRIVILEGES FOR ROLE olius_owner IN SCHEMA public '
                'GRANT EXECUTE ON FUNCTIONS TO olius_reader;', database=CLONE)
        execute(file='PostgreSQL/migrations/20261104_schedule_idempotency.sql',
                database=CLONE, expected_error='42501')
        if execute("SELECT to_regclass('public.collection_schedule_command') IS NULL "
                   "AND to_regprocedure('" + SIGNATURE + "') IS NULL;", database=CLONE) != 't':
            raise AssertionError('Rejected migration left partial objects')
        execute('ALTER DEFAULT PRIVILEGES FOR ROLE olius_owner IN SCHEMA public '
                'REVOKE EXECUTE ON FUNCTIONS FROM olius_reader;', database=CLONE)
        execute(file='PostgreSQL/migrations/20261104_schedule_idempotency.sql', database=CLONE)
        if execute("SELECT has_function_privilege('olius_api','" + SIGNATURE + "','EXECUTE') "
                   "AND NOT has_function_privilege('olius_reader','" + SIGNATURE + "','EXECUTE');",
                   database=CLONE) != 't':
            raise AssertionError('Migration ACL mismatch')
    finally:
        if created:
            execute('DROP DATABASE ' + CLONE + ';', database=maintenance)
    print('PASS: explicit reader grant rejected, default grant rejected atomically, authorized deployment preserved')


if __name__ == '__main__':
    main()
