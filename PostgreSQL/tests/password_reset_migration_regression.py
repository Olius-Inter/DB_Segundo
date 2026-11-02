"""Atualiza uma referência real anterior, sem SUPERUSER e sem apagar seus dados."""
import os
import subprocess
import run_ci

BASE='70aa130cd2fc3c6154641bee1942395458cbdfcb'
DATABASE='olius_reset_migration_test'
DEPLOYER='olius_reset_migration_deployer'
SCRIPT='PostgreSQL/migrations/20261101_password_reset.sql'


def execute(sql, database=None, *, batch=False):
    args=run_ci.command()+['-qAt']
    if database:
        if '-d' in args: args[args.index('-d')+1]=database
        else: args+=['-d',database]
    if batch: args+=['-c',sql]
    p=subprocess.run(args,input=None if batch else sql,text=True,encoding='utf-8',capture_output=True,timeout=180)
    if p.returncode: raise RuntimeError(p.stderr[-6000:])
    return p.stdout.strip()


def original(path):
    p=subprocess.run(['git','show',BASE+':'+path],cwd=run_ci.ROOT,capture_output=True,check=True)
    return p.stdout.decode('utf-8')


def main():
    if os.environ.get('OLIUS_CI_DISPOSABLE')!='1': raise RuntimeError('Exige servidor descartável')
    occupied=execute("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='"+DATABASE+"') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='"+DEPLOYER+"');")
    if occupied!='f': raise RuntimeError('Não reutilizar banco ou papel preexistente')
    created=False
    role_created=False
    try:
        execute('CREATE ROLE '+DEPLOYER+' NOLOGIN NOSUPERUSER CREATEDB CREATEROLE INHERIT;')
        role_created=True
        execute('GRANT olius_owner,olius_reader,olius_api,olius_ranking_reader,olius_bi_reader_role,olius_bi_refresh_role,olius_auth_owner,olius_business_owner,olius_dm_owner TO '+DEPLOYER+' WITH ADMIN TRUE,INHERIT TRUE,SET TRUE;')
        execute('CREATE DATABASE '+DATABASE+' OWNER '+DEPLOYER+';');created=True
        prefix='SET SESSION AUTHORIZATION '+DEPLOYER+';\n'
        scripts=['01_structure.sql','02_check_constraints.sql','03_indexes.sql','04_functions_procedures.sql','05_triggers.sql','06_ctes.sql','07_window_functions.sql','08_materialized_views.sql']
        scripts+=['data_catalog/'+n for n in ['01_structure.sql','02_check_constraints.sql','03_view.sql','04_load.sql']]
        scripts+=['access_control/01_roles.sql','access_control/02_users.sql']
        for s in scripts: execute(prefix+original('PostgreSQL/'+s),DATABASE)
        execute(prefix+"INSERT INTO users(id,name,email,password_hash,user_type) VALUES('15000000-0000-0000-0000-000000000001','Migration preserved','preserved@reset.invalid','preserved-hash','CITIZENS'); SELECT * FROM open_auth_session('15000000-0000-0000-0000-000000000001',sha256('preserved-refresh'::BYTEA)); SELECT issue_bootstrap_admin_invitation('Bootstrap preserved','bootstrap@reset.invalid',sha256('preserved-invitation'::BYTEA));",DATABASE)
        snap="SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM users t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth_session t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth_refresh_token t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM admin_invitation t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY log_id) FROM users_log t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY log_id) FROM auth_session_log t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY log_id) FROM admin_invitation_log t));"
        before=execute(snap,DATABASE)
        # Carga documental nova sobre base ainda antiga não deve inventar tabelas.
        catalog=(run_ci.ROOT/'PostgreSQL/data_catalog/04_load.sql').read_text(encoding='utf-8')
        execute(prefix+catalog,DATABASE)
        if execute("SELECT count(*) FROM data_catalog_table WHERE table_name IN ('password_reset_token','password_reset_token_log');",DATABASE)!='0':
            raise AssertionError('Catálogo documentou tabela física ausente')
        # psql deve confirmar ALTER TYPE antes de iniciar o bloco principal.
        migration=(run_ci.ROOT/SCRIPT).read_text(encoding='utf-8')
        execute(prefix+migration,DATABASE,batch=True)
        if execute(snap,DATABASE)!=before: raise AssertionError('Usuários, senhas, sessões, convites ou logs alterados')
        assert execute("SELECT to_regprocedure('public.open_auth_session(uuid,bytea)') IS NULL AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname='"+DEPLOYER+"');",DATABASE)=='t'
        execute('SET SESSION AUTHORIZATION olius_core_api; SELECT * FROM issue_password_reset(\'preserved@reset.invalid\',sha256(\'migration-reset\'::BYTEA));',DATABASE)
        assert execute('SET SESSION AUTHORIZATION olius_core_api; SELECT complete_password_reset(sha256(\'migration-reset\'::BYTEA),\'migrated-hash\');',DATABASE)=='OK'
        # SQL novo e migrado devem expor exatamente a mesma definição das três rotinas.
        for name in ['open_auth_session','issue_password_reset','complete_password_reset']:
            query="SELECT pg_get_functiondef(oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='"+name+"';"
            if execute(query,DATABASE)!=execute(query): raise AssertionError('Definição divergente: '+name)
        execute(prefix+"UPDATE data_catalog_table SET description='Revisão humana da tabela',business_rules='Regra revisada',access_policy='Política revisada' WHERE table_name IN ('password_reset_token','password_reset_token_log'); UPDATE data_catalog_column SET description='Revisão humana da coluna',source_reference='Fonte revisada' WHERE table_catalog_id IN (SELECT id FROM data_catalog_table WHERE table_name IN ('password_reset_token','password_reset_token_log'));",DATABASE)
        catalog_snapshot="SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY table_name) FROM data_catalog_table t WHERE table_name IN ('password_reset_token','password_reset_token_log')),(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM data_catalog_column c WHERE table_catalog_id IN (SELECT id FROM data_catalog_table WHERE table_name IN ('password_reset_token','password_reset_token_log'))));"
        manual=execute(catalog_snapshot,DATABASE)
        execute(prefix+catalog,DATABASE)
        if execute(catalog_snapshot,DATABASE)!=manual:
            raise AssertionError('Carga sobrescreveu documentação humana')
        print('PASS: catálogo sem referências fantasmas e reaplicação preservando edições humanas')
        print('PASS: migração da referência anterior sem SUPERUSER; dados preservados; Core operacional; definições iguais')
    finally:
        if created: execute('DROP DATABASE '+DATABASE+' WITH (FORCE);')
        if role_created:
            execute('SET SESSION AUTHORIZATION '+DEPLOYER+"; DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT g.rolname AS grp,u.rolname AS member FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE m.grantor=current_user::regrole LOOP EXECUTE format('REVOKE %I FROM %I GRANTED BY %I',r.grp,r.member,current_user); END LOOP; END $$;")
            execute('DROP ROLE '+DEPLOYER+';')



if __name__=='__main__': main()
