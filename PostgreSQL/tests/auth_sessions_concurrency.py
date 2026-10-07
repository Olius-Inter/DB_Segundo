"""Sessões de autenticação: duas conexões reais em banco descartável com 01..05.

Local: OLIUS_TEST_DOCKER_CONTAINER=nome (Docker com usuário postgres/db olius_test).
CI: usa psql e as variáveis PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
Não instala os scripts 01..05. Lê apenas a fixture SQL ao lado deste arquivo
e a envia pelo stdin ao psql; não é necessário copiá-la para o contêiner.
Cria dados artificiais no banco descartável e não escreve arquivos locais.
"""
import os
import subprocess
import time
from pathlib import Path

container = os.environ.get("OLIUS_TEST_DOCKER_CONTAINER")
base = (["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", os.environ.get("PGDATABASE", "olius_test")]
        if container else ["psql"])
command = base + ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
process_options = {"encoding": "utf-8"}
if os.name == "nt":
    process_options["creationflags"] = subprocess.CREATE_NO_WINDOW


def query(sql):
    result = subprocess.run(command, input=sql, text=True, capture_output=True,
                            timeout=30, check=False, **process_options)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def pair(label, first, second, second_should_fail=False, rollback_first=False, hold_seconds=0):
    """A segura locks até receber COMMIT; confirma que B realmente espera lock."""
    a = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, bufsize=1, **process_options)
    b = None
    try:
        a.stdin.write("BEGIN; SET statement_timeout='15s';\n" + first + "\n\\echo READY\n")
        a.stdin.flush()
        # statement_timeout e timeout externo do CI limitam qualquer falha.
        while True:
            line = a.stdout.readline()
            if line.strip() == "READY":
                break
            if not line:
                raise RuntimeError(a.stderr.read())
        b = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True, **process_options)
        b.stdin.write("SET application_name='olius_pr13_session_b'; SET statement_timeout='15s';\n" + second + "\n")
        b.stdin.close()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            waiting = query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='olius_pr13_session_b' AND wait_event_type='Lock');")
            if waiting == "t":
                break
            if b.poll() is not None:
                raise RuntimeError("Sessão B terminou sem esperar o lock: " + b.stderr.read())
            time.sleep(0.05)
        else:
            raise RuntimeError("Não foi observada espera de lock")
        if hold_seconds:
            time.sleep(hold_seconds)
        a.stdin.write("ROLLBACK;\n" if rollback_first else "COMMIT;\n")
        a.stdin.close()
        a.wait(timeout=20)
        b.wait(timeout=20)
        error_a, error_b = a.stderr.read(), b.stderr.read()
        if a.returncode or (bool(b.returncode) != second_should_fail):
            raise RuntimeError(error_a + error_b)
        if second_should_fail and "Recarregue" not in error_b:
            raise RuntimeError("Falha inesperada: " + error_b)
        print("PASS:", label, "(espera de lock observada)")
    finally:
        for proc in (a, b):
            if proc is not None and proc.poll() is None:
                proc.kill()
                proc.wait()


def assert_db(expression):
    if query('SELECT (' + expression + ');') != 't':
        raise RuntimeError('Falha na verificação: ' + expression)


def fixture(label, expires=False):
    uid = query("INSERT INTO public.users(name,email,password_hash,user_type) VALUES ('Auth concurrency','" + label + "@auth.test','test','CITIZENS') RETURNING id;")
    sid = query("SELECT session_id FROM public.open_auth_session('" + uid + "',sha256('" + label + "'::bytea));")
    if expires:
        # Fixture administrativa: a janela termina enquanto B aguarda users.
        query("UPDATE public.auth_session SET idle_expires_at=clock_timestamp()+INTERVAL '5 seconds' WHERE id='" + sid + "';")
    return uid, sid


def rotate(label, successor):
    return "SET ROLE olius_api; SELECT result_code FROM public.rotate_auth_refresh_token(sha256('" + label + "'::bytea),sha256('" + successor + "'::bytea));"


uid, sid = fixture('same')
pair('duas renovações do mesmo token: segunda revoga', rotate('same','sameA'), rotate('same','sameB'))
assert_db("(SELECT revocation_reason='REFRESH_REUSE' FROM public.auth_session WHERE id='" + sid + "')")
assert_db("(SELECT COUNT(*)=2 FROM public.auth_refresh_token WHERE session_id='" + sid + "')")
assert_db("NOT EXISTS(SELECT 1 FROM public.auth_refresh_token WHERE token_hash=sha256('sameB'::bytea))")
assert_db("(SELECT bool_and(actor_kind='SYSTEM' AND performed_by IS NULL) FROM public.auth_session_log WHERE id='" + sid + "' AND revocation_reason='REFRESH_REUSE')")

uid, sid = fixture('rotate_first')
pair('renovação seguida de inativação', rotate('rotate_first','rotate_firstA'), "UPDATE public.users SET status='INACTIVE' WHERE id='"+uid+"';")
assert_db("(SELECT revocation_reason='ACCOUNT_INACTIVE' FROM public.auth_session WHERE id='"+sid+"')")

uid, sid = fixture('inactive_first')
pair('inativação antes da renovação', "UPDATE public.users SET status='INACTIVE' WHERE id='"+uid+"';", rotate('inactive_first','inactive_firstA'))
assert_db("(SELECT COUNT(*)=1 FROM public.auth_refresh_token WHERE session_id='"+sid+"')")
assert_db("(SELECT revocation_reason='ACCOUNT_INACTIVE' FROM public.auth_session WHERE id='"+sid+"')")

uid, sid = fixture('rollback')
pair('rollback da primeira rotação libera o token original', rotate('rollback','rollbackA'), rotate('rollback','rollbackB'), rollback_first=True)
assert_db("(SELECT revoked_at IS NULL FROM public.auth_session WHERE id='"+sid+"')")
assert_db("NOT EXISTS(SELECT 1 FROM public.auth_refresh_token WHERE token_hash=sha256('rollbackA'::bytea))")
assert_db("EXISTS(SELECT 1 FROM public.auth_refresh_token WHERE token_hash=sha256('rollbackB'::bytea))")

uid, sid = fixture('logout')
pair('logout bloqueia renovação', "SET ROLE olius_api; SELECT public.revoke_auth_session('"+uid+"','"+sid+"');", rotate('logout','logoutA'))
assert_db("(SELECT COUNT(*)=1 FROM public.auth_refresh_token WHERE session_id='"+sid+"')")

# B inicia a renovação antes da expiração, mas espera A liberar users.
# O relógio consultado depois do lock deve detectar o prazo já encerrado.
uid, sid = fixture('expired_wait', expires=True)
pair('prazo expira durante espera do lock', "SELECT 1 FROM public.users WHERE id='"+uid+"' FOR UPDATE;", rotate('expired_wait','expired_waitA'), hold_seconds=6)
assert_db("(SELECT COUNT(*)=1 FROM public.auth_refresh_token WHERE session_id='"+sid+"')")

uid, sid = fixture('login_race')
pair('login seguido de inativação não deixa sessão ativa',
     "SET ROLE olius_api; SELECT * FROM public.open_auth_session('"+uid+"',sha256('login_race2'::bytea));",
     "UPDATE public.users SET status='INACTIVE' WHERE id='"+uid+"';")
assert_db("(SELECT COUNT(*)=2 AND bool_and(revoked_at IS NOT NULL) FROM public.auth_session WHERE user_id='"+uid+"')")
print('PASS: sete disputas concorrentes; revogação confirmada após COMMIT')


