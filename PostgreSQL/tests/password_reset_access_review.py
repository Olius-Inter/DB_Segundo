"""Comprova rejeição de EXECUTE externo e reaplicação válida em banco descartável."""
import os
import subprocess
import run_ci

ROLE='olius_reset_unreviewed_test'


def sql(text):
    return run_ci.execute('password-reset-acl-query',run_ci.command()+['-qAt'],text).strip()


def main():
    if os.environ.get('OLIUS_CI_DISPOSABLE')!='1': raise RuntimeError('Exige banco descartável')
    if sql("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='"+ROLE+"');")!='f':
        raise RuntimeError('Papel de teste preexistente não será alterado')
    sql('CREATE ROLE '+ROLE+' NOLOGIN;')
    try:
        sql('GRANT EXECUTE ON FUNCTION public.issue_password_reset(TEXT,BYTEA,INTERVAL),public.complete_password_reset(BYTEA,TEXT) TO '+ROLE+';')
        relative='PostgreSQL/access_control/01_roles.sql'
        path='/workspace/'+relative if os.environ.get('OLIUS_TEST_DOCKER_CONTAINER') else str(run_ci.ROOT/relative)
        result=subprocess.run(run_ci.command()+['-f',path],capture_output=True,text=True,encoding='utf-8',timeout=180)
        if not result.returncode or 'EXECUTE externo' not in result.stderr:
            raise AssertionError('Reaplicação não rejeitou a concessão externa: '+result.stderr)
        if sql("SELECT has_function_privilege('"+ROLE+"','public.complete_password_reset(bytea,text)','EXECUTE');")!='t':
            raise AssertionError('Não remover concessão externa silenciosamente')
    finally:
        sql('REVOKE ALL ON FUNCTION public.issue_password_reset(TEXT,BYTEA,INTERVAL),public.complete_password_reset(BYTEA,TEXT) FROM '+ROLE+'; DROP ROLE '+ROLE+';')
    run_ci.sql_file('PostgreSQL/access_control/01_roles.sql')
    if sql("SELECT has_function_privilege('olius_api','public.complete_password_reset(bytea,text)','EXECUTE') AND NOT has_function_privilege('olius_reader','public.complete_password_reset(bytea,text)','EXECUTE');")!='t':
        raise AssertionError('Contrato normal de acesso alterado')
    print('PASS: EXECUTE externo rejeitado; rollback preserva concessão para revisão; reaplicação válida permitida')


if __name__=='__main__': main()
