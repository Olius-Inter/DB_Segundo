"""Disputas reais de recuperação em duas conexões; somente servidor descartável."""
import os
import subprocess
import time
import run_ci


def query(sql):
    result = subprocess.run(run_ci.command()+['-qAt'], input=sql, text=True,
                            encoding='utf-8', capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def dispute(first, second, expected):
    """A mantém a transação aberta até observar B esperando o bloqueio."""
    options={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}
    processes=[]
    try:
        a=subprocess.Popen(run_ci.command()+['-qAt'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE,text=True,encoding='utf-8',bufsize=1,**options)
        processes.append(a)
        a.stdin.write("BEGIN; SET statement_timeout='15s';\n"+first+"\n\\echo READY\n")
        a.stdin.flush()
        while True:
            line=a.stdout.readline()
            if line.strip()=='READY': break
            if not line: raise RuntimeError(a.stderr.read())
        b=subprocess.Popen(run_ci.command()+['-qAt'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE,text=True,encoding='utf-8',**options)
        processes.append(b)
        b.stdin.write("SET application_name='olius_reset_waiter'; SET statement_timeout='15s';\n"+second)
        b.stdin.close()
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            if query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='olius_reset_waiter' AND wait_event_type='Lock');")=='t': break
            if b.poll() is not None: raise RuntimeError('B não aguardou o lock: '+b.stderr.read())
            time.sleep(0.05)
        else: raise RuntimeError('Espera de lock não observada')
        a.stdin.write('COMMIT;\n');a.stdin.close()
        a.wait(timeout=20);b.wait(timeout=20)
        output=b.stdout.read().strip()
        if a.returncode or b.returncode or expected not in output:
            raise RuntimeError(a.stderr.read()+b.stderr.read()+output+' / esperado '+expected)
    finally:
        for p in processes:
            if p.poll() is None: p.kill();p.wait()


def fixture(label):
    uid=query("INSERT INTO users(name,email,password_hash,user_type) VALUES('Reset concurrency','reset-"+label+"@test.invalid','old-hash','CITIZENS') RETURNING id;")
    query("INSERT INTO password_reset_token(user_id,token_hash,issued_at,expires_at) SELECT '"+uid+"',sha256(('reset-"+label+"-'||n)::BYTEA),clock_timestamp()-INTERVAL '2 minutes',clock_timestamp()+INTERVAL '30 minutes' FROM generate_series(1,2) n;")
    sid=query("SELECT session_id FROM open_auth_session('"+uid+"',sha256('refresh-"+label+"'::BYTEA),'old-hash');")
    return uid,sid


def complete(label,n=1):
    return "SET ROLE olius_api; SELECT complete_password_reset(sha256('reset-"+label+'-'+str(n)+"'::BYTEA),'new-hash');"


def check_no_live_session(uid):
    if query("SELECT NOT EXISTS(SELECT 1 FROM auth_session WHERE user_id='"+uid+"' AND revoked_at IS NULL);")!='t':
        raise AssertionError('Sessão válida após recuperação')


def main():
    if os.environ.get('OLIUS_CI_DISPOSABLE')!='1': raise RuntimeError('Exige banco descartável')
    for label,n in [('same',1),('different',2)]:
        uid,_=fixture(label)
        dispute(complete(label),complete(label,n),'INVALID_TOKEN')
        check_no_live_session(uid)
        if query("SELECT count(*) FROM password_reset_token WHERE user_id='"+uid+"' AND consumed_at IS NOT NULL;")!='1': raise AssertionError('Mais de um consumo')
        print('PASS: conclusão concorrente '+label)
    uid,_=fixture('login')
    login="SET ROLE olius_api; SELECT result_code FROM open_auth_session('"+uid+"',sha256('stale-login'::BYTEA),'old-hash');"
    dispute(complete('login'),login,'CREDENTIAL_CHANGED');check_no_live_session(uid)
    print('PASS: recuperação antes do login validado com senha antiga')
    uid,_=fixture('loginfirst')
    login="SET ROLE olius_api; SELECT result_code FROM open_auth_session('"+uid+"',sha256('first-login'::BYTEA),'old-hash');"
    dispute(login,complete('loginfirst'),'OK');check_no_live_session(uid)
    print('PASS: login anterior também é revogado')
    for label,reverse in [('refresh',False),('refreshfirst',True)]:
        uid,_=fixture(label)
        rotation="SET ROLE olius_api; SELECT result_code FROM rotate_auth_refresh_token(sha256('refresh-"+label+"'::BYTEA),sha256('next-"+label+"'::BYTEA));"
        dispute(rotation if reverse else complete(label),complete(label) if reverse else rotation,'OK' if reverse else 'SESSION_REVOKED')
        check_no_live_session(uid)
        print('PASS: refresh e recuperação '+label)
    for label,reverse in [('inactive',False),('inactivefirst',True)]:
        uid,_=fixture(label)
        inactive="UPDATE users SET status='INACTIVE' WHERE id='"+uid+"'; SELECT 'INACTIVE_DONE';"
        dispute(inactive if reverse else complete(label),complete(label) if reverse else inactive,'INVALID_TOKEN' if reverse else 'INACTIVE_DONE')
        check_no_live_session(uid)
        print('PASS: inativação e recuperação '+label)
    uid=query("INSERT INTO users(name,email,password_hash,user_type) VALUES('Issue concurrency','issue-concurrency@test.invalid','old-hash','CITIZENS') RETURNING id;")
    issue=lambda key:"SET ROLE olius_api; SELECT result_code FROM issue_password_reset('issue-concurrency@test.invalid',sha256('"+key+"'::BYTEA));"
    dispute(issue('concurrent1'),issue('concurrent2'),'RATE_LIMITED')
    if query("SELECT count(*) FROM password_reset_token WHERE user_id='"+uid+"';")!='1': raise AssertionError('Emissão extra concorrente')
    print('PASS: emissões simultâneas respeitam intervalo')


if __name__=='__main__': main()
