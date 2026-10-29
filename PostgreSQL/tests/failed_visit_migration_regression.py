"""Migração reaplicável, preservação de dados e equivalência com instalação nova."""
import os
import subprocess

import run_ci

DATABASE = 'olius_visit_migration_test'
ROLE = 'olius_visit_deployer_test'


def execute(sql=None, relative=None, *, base=False):
    args = run_ci.command()
    if not base:
        if '-d' in args:
            args[args.index('-d')+1] = DATABASE
        else:
            args.extend(['-d', DATABASE])
    if relative:
        path = '/workspace/'+relative if os.environ.get('OLIUS_TEST_DOCKER_CONTAINER') else str(run_ci.ROOT/relative)
        args.extend(['-f', path])
    result = subprocess.run(args+['-qAt'],input=sql,capture_output=True,text=True,encoding='utf-8',timeout=120)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])
    return result.stdout.strip()


def main():
    if os.environ.get('OLIUS_CI_DISPOSABLE')!='1':
        raise RuntimeError('Exige servidor descartável confirmado.')
    source=(run_ci.ROOT/'PostgreSQL/04_functions_procedures.sql').read_text(encoding='utf-8')
    migration=(run_ci.ROOT/'PostgreSQL/migrations/20261029_failed_collection_visit.sql').read_text(encoding='utf-8')
    for name,end_marker in [('record_collection_internal','-- =============================================================================\n-- 8.'),
                            ('correct_collection','-- =============================================================================\n-- 10.')]:
        start=source.index('CREATE OR REPLACE PROCEDURE public.'+name+'(')
        block=source[start:source.index(end_marker,start)]
        if block not in migration:
            raise AssertionError('Migração diverge da definição canônica: '+name)
    if execute("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='%s') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='%s');"%(DATABASE,ROLE),base=True)!='f':
        raise RuntimeError('Banco/papel de teste ocupado; não será alterado.')
    execute('CREATE DATABASE '+DATABASE+';',base=True)
    created_role=False
    try:
        files=['PostgreSQL/'+x for x in ['01_structure.sql','02_check_constraints.sql','03_indexes.sql','04_functions_procedures.sql','05_triggers.sql','06_ctes.sql','07_window_functions.sql','08_materialized_views.sql']]
        for f in files:
            execute(relative=f)
        for f in ['01_structure.sql','02_check_constraints.sql','03_view.sql','04_load.sql']:
            execute(relative='PostgreSQL/data_catalog/'+f)
        execute(relative='PostgreSQL/access_control/01_roles.sql')
        execute(relative='PostgreSQL/access_control/02_users.sql')
        execute("DROP FUNCTION public.record_failed_collection_visit(UUID,UUID,TEXT,TEXT); DROP PROCEDURE public.record_collection_internal(UUID,UUID,NUMERIC,NUMERIC,public.oil_condition_t,BOOLEAN,TEXT[],TEXT,TIMESTAMPTZ,UUID);")
        # Reconstitui as duas rotinas anteriores, mantendo todo o resto atual.
        execute(relative='PostgreSQL/tests/fixtures_legacy_collection.sql')
        execute(relative='PostgreSQL/tests/fixtures_procedures.sql')
        execute("DO $$ DECLARE r UUID; c UUID; BEGIN r:=olius_test.request(); CALL public.record_collection(r,olius_test.id('driver'),10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,now(),c); END $$;")
        before=execute('SELECT md5(jsonb_agg(to_jsonb(c) ORDER BY id)::TEXT) FROM public.collection c;')
        # Instalador sem SUPERUSER com memberships explícitas, sem SET app.*.
        execute('CREATE ROLE '+ROLE+' NOLOGIN NOSUPERUSER;',base=True)
        created_role=True
        execute('ALTER DATABASE '+DATABASE+' OWNER TO '+ROLE+';',base=True)
        execute('GRANT olius_business_owner,olius_owner TO '+ROLE+';',base=True)
        execute('GRANT USAGE,CREATE ON SCHEMA public TO '+ROLE+';')
        execute("DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT p.oid,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname IN ('record_collection','correct_collection') LOOP EXECUTE format('ALTER PROCEDURE %s OWNER TO olius_business_owner',r.oid::regprocedure); END LOOP; END $$;")
        for _ in range(2):
            execute('SET SESSION AUTHORIZATION '+ROLE+';\n'+migration)
        if before!=execute('SELECT md5(jsonb_agg(to_jsonb(c) ORDER BY id)::TEXT) FROM public.collection c;'):
            raise AssertionError('Migração alterou fato existente.')
        if execute("SELECT count(*)=2 FROM collection_failure_reason WHERE code IN ('ESTABLISHMENT_CLOSED','NO_RESPONSIBLE_AVAILABLE');")!='t':
            raise AssertionError('Motivos ausentes/duplicados.')
        # Mesmo contrato de propriedade/segurança da instalação nova.
        if execute("SELECT count(*)=4 AND bool_and(proowner='olius_business_owner'::regrole AND prosecdef=(proname<>'record_collection_internal') AND has_function_privilege('olius_api',oid,'EXECUTE')=(proname<>'record_collection_internal')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('record_collection_internal','record_collection','record_failed_collection_visit','correct_collection');")!='t':
            raise AssertionError('ACL/proprietário divergentes.')
        execute("SELECT public.record_failed_collection_visit(olius_test.request(10,FALSE),olius_test.id('admin'),'ESTABLISHMENT_CLOSED','Visita migrada');")
        print('PASS: migração duas vezes sem SUPERUSER, dados preservados e visita registrada')
    finally:
        execute('DROP DATABASE '+DATABASE+' WITH (FORCE);',base=True)
        if created_role:
            execute('DROP ROLE '+ROLE+';',base=True)


if __name__=='__main__':
    main()
