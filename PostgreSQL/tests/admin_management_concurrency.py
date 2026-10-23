"""Último ADMIN e uso único: duas conexões reais, em banco descartável próprio."""
import os
import subprocess
import time

import run_ci


NAME = "olius_admin_concurrency"
A = "74000000-0000-0000-0000-000000000001"
B = "74000000-0000-0000-0000-000000000002"


def execute(sql=None, relative=None, *, base=False):
    args = run_ci.command()
    if not base:
        if "-d" in args:
            args[args.index("-d") + 1] = NAME
        else:
            args.extend(["-d", NAME])
    args.append("-qAt")
    if relative:
        path = "/workspace/" + relative if os.environ.get("OLIUS_TEST_DOCKER_CONTAINER") else str(run_ci.ROOT / relative)
        args.extend(["-f", path])
    result = subprocess.run(args, input=sql, capture_output=True, text=True,
                            encoding="utf-8", timeout=120, cwd=run_ci.ROOT)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:])
    return result.stdout.strip()


def verify(condition, explanation):
    if execute("SELECT " + condition) != "t":
        raise AssertionError(explanation)


def pair(first, second, isolation, expected_code):
    command = run_ci.command()
    if "-d" in command:
        command[command.index("-d") + 1] = NAME
    else:
        command.extend(["-d", NAME])
    command.append("-qAt")
    left = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, encoding="utf-8")
    right = None
    try:
        left.stdin.write("BEGIN; SET statement_timeout='15s';\n" + first + ";\n\\echo READY\n")
        left.stdin.flush()
        while True:
            line = left.stdout.readline()
            if line.strip() == "READY":
                break
            if not line:
                raise RuntimeError(left.stderr.read())
        right = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, encoding="utf-8")
        right.stdin.write("\\set VERBOSITY verbose\nBEGIN ISOLATION LEVEL " + isolation + ";\n"
                          "SET statement_timeout='15s'; SET application_name='olius_admin_peer';\n"
                          "SELECT count(*) FROM public.users;\n" + second + ";\nCOMMIT;\n")
        right.stdin.close()
        right.stdin = None
        for _ in range(80):
            waiting = execute("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE "
                                 "application_name='olius_admin_peer' AND wait_event_type='Lock');")
            if waiting == "t":
                break
            if right.poll() is not None:
                raise RuntimeError("Segunda conexão não aguardou o controle: " + right.stderr.read())
            time.sleep(0.05)
        else:
            raise RuntimeError("Não foi observado bloqueio concorrente.")
        _, error = left.communicate("COMMIT;\n", timeout=25)
        if left.returncode:
            raise RuntimeError(error)
        _, error = right.communicate(timeout=25)
        if right.returncode == 0 or expected_code not in error:
            raise RuntimeError("Esperava recusa concorrente " + expected_code + ": " + error)
    finally:
        for process in (left, right):
            if process is not None and process.poll() is None:
                process.kill()
                process.communicate()


def main():
    if os.environ.get("OLIUS_CI_DISPOSABLE") != "1":
        raise RuntimeError("Exige servidor de teste descartável explicitamente confirmado.")
    if execute("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='olius_admin_concurrency');", base=True) != "f":
        raise RuntimeError("Banco já existe; não será removido nem reutilizado.")
    execute("CREATE DATABASE olius_admin_concurrency;", base=True)
    try:
        for file in ("01_structure.sql", "02_check_constraints.sql", "03_indexes.sql",
                     "04_functions_procedures.sql", "05_triggers.sql", "06_ctes.sql",
                     "07_window_functions.sql", "08_materialized_views.sql"):
            execute(relative="PostgreSQL/" + file)
        for file in ("data_catalog/01_structure.sql", "data_catalog/02_check_constraints.sql",
                     "data_catalog/03_view.sql", "data_catalog/04_load.sql",
                     "access_control/01_roles.sql", "access_control/02_users.sql"):
            execute(relative="PostgreSQL/" + file)
        execute("INSERT INTO public.users(id,name,email,password_hash,user_type) VALUES "
                   f"('{A}','A','a@example.invalid','test','ADMIN'),"
                   f"('{B}','B','b@example.invalid','test','ADMIN');")
        for isolation, code in (("READ COMMITTED", "55000"), ("REPEATABLE READ", "40001")):
            pair(f"SELECT public.set_admin_status('{A}','{A}','INACTIVE')",
                 f"SELECT public.set_admin_status('{B}','{B}','INACTIVE')", isolation, code)
            verify("(SELECT count(*) FROM public.users WHERE user_type='ADMIN' AND status='ACTIVE')=1",
                      "Pelo menos um ADMIN deve permanecer ativo.")
            execute(f"SELECT public.set_admin_status('{B}','{A}','ACTIVE');")
        for number, (isolation, code) in enumerate((("READ COMMITTED", "55000"), ("REPEATABLE READ", "40001"))):
            secret = "admin-concurrency-" + str(number)
            email = "concurrent" + str(number) + "@example.invalid"
            execute(f"SELECT public.issue_admin_invitation('{A}','Convidado','{email}',sha256('{secret}'::bytea));")
            accept = f"SELECT public.accept_admin_invitation(sha256('{secret}'::bytea),'test-hash')"
            pair(accept, accept, isolation, code)
            verify(f"(SELECT count(*) FROM public.users WHERE email='{email}')=1", "Aceite duplicou usuário.")
        print("PASS: admin-concurrency (último ADMIN e aceite único, READ COMMITTED e REPEATABLE READ)")
    finally:
        execute("DROP DATABASE olius_admin_concurrency WITH (FORCE);", base=True)


if __name__ == "__main__":
    main()
