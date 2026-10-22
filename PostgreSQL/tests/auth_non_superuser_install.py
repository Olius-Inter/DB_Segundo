"""Instala 01–05 como dono de banco sem SUPERUSER nem SET nos parâmetros app.*."""
import os
import subprocess

import run_ci


DATABASE = "olius_install_without_superuser"
ROLE = "olius_install_regression"


def execute(label, sql, *, target=False, failure=None):
    args = run_ci.command()
    if target:
        if "-d" in args:
            args[args.index("-d") + 1] = DATABASE
        else:
            args.extend(["-d", DATABASE])
    args.extend(["-qAt", "-v", "VERBOSITY=verbose"])
    if failure:
        result = subprocess.run(args, input=sql, text=True, encoding="utf-8",
                                capture_output=True, cwd=run_ci.ROOT, timeout=180)
        if result.returncode == 0 or failure not in result.stderr:
            raise AssertionError("A conta de teste deve reproduzir a restrição original: " + result.stderr)
        return result.stdout.strip()
    return run_ci.execute(label, args, sql).strip()


def main():
    if os.environ.get("OLIUS_CI_DISPOSABLE") != "1":
        raise RuntimeError("Exige servidor de teste descartável explicitamente confirmado.")
    occupied = execute("non-superuser-preflight", f"SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='{DATABASE}') "
                       f"OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='{ROLE}');")
    if occupied != "f":
        raise RuntimeError("Banco ou papel de teste já existe; não será reutilizado ou removido.")
    execute("non-superuser-role", f"CREATE ROLE {ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE "
            "NOINHERIT NOREPLICATION NOBYPASSRLS;")
    created = False
    try:
        execute("non-superuser-database", f"CREATE DATABASE {DATABASE} OWNER {ROLE};")
        created = True
        execute("non-superuser-permissions", f"SET SESSION AUTHORIZATION {ROLE}; DO $$ BEGIN "
                "IF (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR EXISTS("
                "SELECT 1 FROM unnest(ARRAY['app.audit_actor','app.current_user_id',"
                "'app.operational_driver_id','app.audit_reason']) p WHERE has_parameter_privilege(current_user,p,'SET')) "
                "THEN RAISE EXCEPTION 'Conta de teste possui privilégios indevidos.'; END IF; END $$;", target=True)
        execute("non-superuser-original-error", f"SET SESSION AUTHORIZATION {ROLE}; "
                "CREATE FUNCTION public.restricted_parameter_probe() RETURNS void LANGUAGE plpgsql "
                "SET app.audit_actor='SYSTEM' AS $$ BEGIN RETURN; END $$;", target=True, failure="42501")
        includes = []
        for name in ("01_structure.sql", "02_check_constraints.sql", "03_indexes.sql",
                     "04_functions_procedures.sql", "05_triggers.sql"):
            relative = "PostgreSQL/" + name
            path = "/workspace/" + relative if os.environ.get("OLIUS_TEST_DOCKER_CONTAINER") else str(run_ci.ROOT / relative)
            includes.append("\\i '" + path.replace("\\", "/") + "'")
        execute("non-superuser-install", f"SET SESSION AUTHORIZATION {ROLE};\n" + "\n".join(includes), target=True)
        smoke = f"""SET SESSION AUTHORIZATION {ROLE};
        BEGIN;
        SELECT set_config('app.audit_actor','EXTERNAL',true);
        SELECT result_code FROM public.open_auth_session(NULL,NULL);
        SELECT result_code FROM public.rotate_auth_refresh_token(NULL,NULL);
        SELECT public.revoke_auth_session(NULL,NULL);
        SELECT result_code FROM public.revoke_user_auth_sessions(NULL);
        DO $$ BEGIN
          IF current_setting('app.audit_actor')<>'EXTERNAL' THEN
            RAISE EXCEPTION 'Contexto externo não restaurado.';
          END IF;
        END $$;
        ROLLBACK;"""
        execute("non-superuser-smoke", smoke, target=True)
        print("PASS: instalação 01–05 sem SUPERUSER e sem GRANT SET em parâmetros personalizados")
    finally:
        if created:
            execute("non-superuser-drop-database", f"DROP DATABASE {DATABASE} WITH (FORCE);")
        execute("non-superuser-drop-role", f"DROP ROLE {ROLE};")


if __name__ == "__main__":
    main()
