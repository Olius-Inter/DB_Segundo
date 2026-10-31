"""Migração sem SUPERUSER e leituras MVCC em banco exclusivamente descartável."""
import os
import subprocess
import time

import run_ci

DATABASE='olius_history_migration_test'
ROLE='olius_history_deployer_test'


def command(base=False):
    args=run_ci.command()
    if not base:
        if '-d' in args:
            args[args.index('-d')+1]=DATABASE
        else:
            args.extend(['-d',DATABASE])
    return args+['-qAt','-v','VERBOSITY=verbose']


def execute(sql=None,relative=None,*,base=False,failure=None):
    args=command(base)
    if relative:
        path='/workspace/'+relative if os.environ.get('OLIUS_TEST_DOCKER_CONTAINER') else str(run_ci.ROOT/relative)
        args.extend(['-f',path])
    r=subprocess.run(args,input=sql,capture_output=True,text=True,encoding='utf-8',timeout=120)
    if failure is not None:
        if r.returncode==0 or failure not in r.stderr:
            raise AssertionError('Falha de migração esperada: '+failure+' / '+r.stderr)
        return r.stdout.strip()
    if r.returncode:
        raise RuntimeError(r.stderr[-5000:])
    return r.stdout.strip()


def start_transaction(sql):
    options={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}
    proc=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                          text=True,encoding='utf-8',bufsize=1,**options)
    proc.stdin.write("SET statement_timeout='15s';\n"+sql+"\n\\echo READY\n")
    proc.stdin.flush()
    while True:
        line=proc.stdout.readline()
        if line.strip()=='READY':
            return proc
        if not line:
            error=proc.stderr.read()
            proc.wait(timeout=20)
            raise RuntimeError(error)


def finish_transaction(proc,sql='COMMIT;'):
    proc.stdin.write(sql+'\n')
    proc.stdin.close()
    proc.wait(timeout=20)
    if proc.returncode:
        raise RuntimeError(proc.stderr.read())


def concurrent_read(admin,col):
    writer=reader=None
    try:
        writer=start_transaction("BEGIN; LOCK TABLE public.collection_failure_log IN ACCESS EXCLUSIVE MODE; CALL public.correct_collection('%s',2,'%s','RECORDED',0,2,'UNACCEPTABLE',FALSE,ARRAY['VOLUME_OUT_OF_TOLERANCE','OIL_UNACCEPTABLE'],'Terceira revisão','Concorrência');"%(col,admin))
        # A chamada começa antes do commit e espera no log. O snapshot não pode
        # misturar o fato anterior com associações publicadas durante essa espera.
        options={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}
        reader=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                                text=True,encoding='utf-8',**options)
        reader.stdin.write("SET application_name='olius_history_midstatement'; SET statement_timeout='15s'; SET SESSION AUTHORIZATION olius_core_api; SELECT count(*)=2 AND max(revision)=2 AND bool_and(cardinality(failure_reason_ids)=0) FILTER(WHERE revision=2) FROM public.get_collection_revision_history('%s','%s');\n"%(col,admin))
        reader.stdin.close()
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            if execute("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='olius_history_midstatement' AND wait_event_type='Lock');")=='t':
                break
            if reader.poll() is not None:
                raise RuntimeError('Leitor terminou sem aguardar a barreira: '+reader.stderr.read())
            time.sleep(0.05)
        else:
            raise RuntimeError('Espera do leitor não observada.')
        finish_transaction(writer)
        reader.wait(timeout=20)
        result=reader.stdout.read().strip()
        if reader.returncode or result!='t':
            raise AssertionError('Leitura misturou revisões durante commit: '+reader.stderr.read()+result)
        if execute("SELECT max(revision)=3 AND bool_and(cardinality(failure_reason_ids)=2) FILTER(WHERE revision=3) FROM public.get_collection_revision_history('%s','%s');"%(col,admin))!='t':
            raise AssertionError('Commit não publicou estado e motivos juntos.')
        reader=start_transaction("SET SESSION AUTHORIZATION olius_core_api; BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT count(*) FROM public.get_collection_revision_history('%s','%s');"%(col,admin))
        execute("CALL public.correct_collection('%s',3,'%s','ANNULLED',NULL,NULL,NULL,NULL,NULL,NULL,'Anulação concorrente');"%(col,admin))
        finish_transaction(reader,"DO $$ BEGIN IF (SELECT max(revision) FROM public.get_collection_revision_history('%s','%s'))<>3 THEN RAISE EXCEPTION 'Snapshot mudou entre páginas.'; END IF; END $$; COMMIT;"%(col,admin))
        if execute("SELECT max(revision)=4 AND bool_and(record_status='ANNULLED' AND cardinality(failure_reason_ids)=0) FILTER(WHERE revision=4) FROM public.get_collection_revision_history('%s','%s');"%(col,admin))!='t':
            raise AssertionError('Nova transação não viu a anulação.')
        print('PASS: leitura durante correção não confirmada e snapshot repetível pela Core')
    finally:
        for proc in (writer,reader):
            if proc is not None and proc.poll() is None:
                proc.kill()
                proc.wait(timeout=20)


def main():
    if os.environ.get('OLIUS_CI_DISPOSABLE')!='1':
        raise RuntimeError('Exige servidor descartável confirmado.')
    source=(run_ci.ROOT/'PostgreSQL/04_functions_procedures.sql').read_text(encoding='utf-8')
    migration=(run_ci.ROOT/'PostgreSQL/migrations/20261030_collection_revision_history.sql').read_text(encoding='utf-8')
    block=source.split('-- BEGIN COLLECTION_REVISION_HISTORY\n')[1].split('-- END COLLECTION_REVISION_HISTORY')[0]
    if block not in migration:
        raise AssertionError('Migração diverge da definição canônica.')
    occupied=execute("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='%s') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='%s');"%(DATABASE,ROLE),base=True)
    if occupied!='f':
        raise RuntimeError('Banco/papel de teste ocupado; não será reutilizado.')
    execute('CREATE DATABASE '+DATABASE+';',base=True)
    created_role=False
    try:
        for name in ['01_structure.sql','02_check_constraints.sql','03_indexes.sql','04_functions_procedures.sql',
                     '05_triggers.sql','06_ctes.sql','07_window_functions.sql','08_materialized_views.sql']:
            execute(relative='PostgreSQL/'+name)
        for name in ['01_structure.sql','02_check_constraints.sql','03_view.sql','04_load.sql']:
            execute(relative='PostgreSQL/data_catalog/'+name)
        execute(relative='PostgreSQL/access_control/01_roles.sql')
        execute(relative='PostgreSQL/access_control/02_users.sql')
        execute(relative='PostgreSQL/tests/fixtures_procedures.sql')
        execute("DO $$ DECLARE c UUID; r UUID; BEGIN r:=olius_test.request(); CALL record_collection(r,olius_test.id('driver'),0,0,'NOT_ASSESSED',FALSE,ARRAY['VOLUME_OUT_OF_TOLERANCE'],'Inicial',now(),c); INSERT INTO olius_test.ids(name,id) VALUES('history',c); CALL correct_collection(c,1,olius_test.id('admin'),'RECORDED',10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],'Sucesso','Correção anterior à migração'); END $$;")
        fingerprint="SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM collection c),(SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM collection_log l),(SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM collection_failure_log l))::TEXT);"
        before=execute(fingerprint)
        fresh_security=execute("SELECT jsonb_build_array(prosecdef,provolatile,proconfig,pg_get_userbyid(proowner),has_function_privilege('olius_api',oid,'EXECUTE'),has_function_privilege('olius_owner',oid,'EXECUTE')) FROM pg_proc WHERE oid='public.get_collection_revision_history(uuid,uuid,integer,integer)'::regprocedure;")
        execute('DROP FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER); DROP INDEX public.idx_collection_failure_log_revision_window;')
        execute('CREATE ROLE '+ROLE+' NOLOGIN NOSUPERUSER;',base=True)
        created_role=True
        execute('ALTER DATABASE '+DATABASE+' OWNER TO '+ROLE+';',base=True)
        execute('GRANT olius_business_owner,olius_owner TO '+ROLE+';',base=True)
        execute('CREATE INDEX idx_collection_failure_log_revision_window ON public.collection_failure_log(failure_reason_id);')
        execute('SET SESSION AUTHORIZATION '+ROLE+';\n'+migration,failure='55000')
        execute('DROP INDEX public.idx_collection_failure_log_revision_window;')
        execute('ALTER DEFAULT PRIVILEGES FOR ROLE '+ROLE+' GRANT EXECUTE ON FUNCTIONS TO olius_reader;')
        execute('SET SESSION AUTHORIZATION '+ROLE+';\n'+migration,failure='42501')
        if execute("SELECT to_regprocedure('public.get_collection_revision_history(uuid,uuid,integer,integer)') IS NULL AND to_regclass('public.idx_collection_failure_log_revision_window') IS NULL;")!='t':
            raise AssertionError('Migração falha deixou objetos parcialmente publicados.')
        execute('ALTER DEFAULT PRIVILEGES FOR ROLE '+ROLE+' REVOKE EXECUTE ON FUNCTIONS FROM olius_reader;')
        for _ in range(2):
            execute('SET SESSION AUTHORIZATION '+ROLE+';\n'+migration)
        execute('GRANT SELECT ON public.collection_log TO olius_api;')
        execute('SET SESSION AUTHORIZATION '+ROLE+';\n'+migration,failure='42501')
        execute('REVOKE SELECT ON public.collection_log FROM olius_api;')
        if execute(fingerprint)!=before:
            raise AssertionError('Migração alterou fatos ou logs.')
        migrated_security=execute("SELECT jsonb_build_array(prosecdef,provolatile,proconfig,pg_get_userbyid(proowner),has_function_privilege('olius_api',oid,'EXECUTE'),has_function_privilege('olius_owner',oid,'EXECUTE')) FROM pg_proc WHERE oid='public.get_collection_revision_history(uuid,uuid,integer,integer)'::regprocedure;")
        if fresh_security!=migrated_security:
            raise AssertionError('Segurança divergente entre instalação e migração.')
        admin=execute("SELECT olius_test.id('admin');")
        col=execute("SELECT olius_test.id('history');")
        execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL SESSION AUTHORIZATION olius_core_api; SELECT set_config('app.audit_actor','EXTERNAL',true); DO $$ BEGIN IF (SELECT count(*) FROM public.get_collection_revision_history('%s','%s'))<>2 OR current_setting('app.audit_actor')<>'EXTERNAL' THEN RAISE EXCEPTION 'Leitura/contexto incompatível.'; END IF; END $$; ROLLBACK;"%(col,admin))
        concurrent_read(admin,col)
        print('PASS: migração reaplicável sem SUPERUSER, dados preservados e segurança equivalente')
    finally:
        execute('DROP DATABASE '+DATABASE+' WITH (FORCE);',base=True)
        if created_role:
            execute('DROP ROLE '+ROLE+';',base=True)


if __name__=='__main__':
    main()
