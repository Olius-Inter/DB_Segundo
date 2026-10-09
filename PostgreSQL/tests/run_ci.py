"""Instala e testa somente um PostgreSQL descartável, com profiler compartilhado.

CI: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE e cliente psql.
Local: OLIUS_TEST_DOCKER_CONTAINER, com o checkout montado em /workspace.
Exige OLIUS_CI_DISPOSABLE=1 para impedir execução acidental no banco real.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "PostgreSQL/tests"
REPORTS = ROOT / "coverage"


def command():
    container = os.environ.get("OLIUS_TEST_DOCKER_CONTAINER")
    base = (["docker", "exec", "-i", container, "psql", "-U", "postgres",
             "-d", os.environ.get("PGDATABASE", "olius_test")] if container else ["psql"])
    return base + ["-X", "-v", "ON_ERROR_STOP=1"]


def execute(label, args, sql=None):
    options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
    environment = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    result = subprocess.run(args, input=sql, text=True, encoding="utf-8",
                            capture_output=True, timeout=180, cwd=ROOT, env=environment, **options)
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / (label + ".log")).write_text(result.stdout + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"{label}:\n{result.stderr[-6000:]}")
    print(f"PASS: {label}", flush=True)
    return result.stdout


def sql_file(relative):
    path = ROOT / relative
    if not path.is_file():
        raise FileNotFoundError(f"Pré-requisito ausente: {relative}")
    database_path = "/workspace/" + relative if os.environ.get("OLIUS_TEST_DOCKER_CONTAINER") else str(path)
    execute(path.stem, command() + ["-f", database_path])


def query(label, sql):
    return execute(label, command() + ["-qAt"], sql)


def main():
    if os.environ.get("OLIUS_CI_DISPOSABLE") != "1":
        raise RuntimeError("Defina OLIUS_CI_DISPOSABLE=1 somente em uma base descartável vazia.")
    if query("empty-database", "SELECT count(*) FROM pg_tables WHERE schemaname='public';").strip() != "0":
        raise RuntimeError("A base de teste deve estar vazia; nenhum objeto será apagado pelo runner.")
    for name in ("01_structure.sql", "02_check_constraints.sql", "03_indexes.sql",
                 "04_functions_procedures.sql", "05_triggers.sql",
                 "06_ctes.sql", "07_window_functions.sql"):
        sql_file("PostgreSQL/" + name)
    query("profiler-init", "CREATE SCHEMA ci_metrics; CREATE EXTENSION plpgsql_check WITH SCHEMA ci_metrics;")
    enabled = query("profiler-enabled", "SELECT current_setting('plpgsql_check.profiler')='on' "
                    "AND current_setting('plpgsql_check.use_shared_stats_when_it_possible')='on' "
                    "AND current_setting('shared_preload_libraries') LIKE '%plpgsql_check%';")
    if enabled.strip() != "t":
        raise RuntimeError("Profiler compartilhado desativado: não é possível medir cobertura entre conexões.")

    has_auth = query("has-auth", "SELECT to_regclass('public.auth_session') IS NOT NULL;").strip() == "t"
    has_access = (ROOT / "PostgreSQL/access_control/01_roles.sql").is_file()
    has_catalog = (ROOT / "PostgreSQL/data_catalog/01_structure.sql").is_file()
    if has_catalog:
        for name in ("01_structure.sql", "02_check_constraints.sql", "03_view.sql", "04_load.sql"):
            sql_file("PostgreSQL/data_catalog/" + name)
    if has_access:
        if not has_catalog or not has_auth:
            raise RuntimeError("Controle de acesso depende do catálogo e das sessões: atualize a branch com as PRs anteriores.")
        sql_file("PostgreSQL/access_control/01_roles.sql")
        sql_file("PostgreSQL/access_control/02_users.sql")
    elif has_auth:
        sql_file("PostgreSQL/tests/ci_auth_bootstrap.sql")
        print("NOTA: permissões de auth são fixture de teste; configuração de produção será testada quando access_control estiver presente.")

    # Registra somente o código de aplicação, antes de criar helpers dos testes.
    inventory = query("routine-inventory", """
        SELECT coalesce(json_agg(row_to_json(r)), '[]'::json) FROM (
          SELECT p.oid, p.oid::regprocedure::text AS signature, p.prosrc AS source
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          JOIN pg_language l ON l.oid=p.prolang
          WHERE n.nspname='public' AND l.lanname='plpgsql' ORDER BY p.oid
        ) r;
    """)
    (REPORTS / "routine-inventory.json").write_text(inventory.strip(), encoding="utf-8")
    query("profiler-reset", "SELECT ci_metrics.plpgsql_profiler_reset_all();")
    sql_file("PostgreSQL/tests/procedures_regression.sql")
    sql_file("PostgreSQL/tests/functions_negative.sql")
    sql_file("PostgreSQL/tests/procedures_negative.sql")
    sql_file("PostgreSQL/tests/annual_views_regression.sql")
    if has_auth:
        sql_file("PostgreSQL/tests/auth_sessions_regression.sql")
        sql_file("PostgreSQL/tests/auth_sessions_edges.sql")
        sql_file("PostgreSQL/tests/operational_regression.sql")
    if has_catalog:
        sql_file("PostgreSQL/data_catalog/05_validate.sql")
    if has_access:
        sql_file("PostgreSQL/tests/catalog_access_regression.sql")
        sql_file("PostgreSQL/tests/api_access_regression.sql")
    else:
        print("NOTA: testes de API/permissões e catálogo/permissões dependem da PR access_control; não executados nesta branch.")

    # Regressões SQL fazem ROLLBACK. Concorrência cria fixtures persistentes:
    # executar por último para não colidir com os schemas das regressões.
    execute("procedures-concurrency", [sys.executable, str(TESTS / "procedures_concurrency.py")])
    if has_auth:
        execute("auth-concurrency", [sys.executable, str(TESTS / "auth_sessions_concurrency.py")])

    routines = json.loads(inventory)
    oid_list = ','.join(str(int(routine['oid'])) for routine in routines)
    raw = query("profiles", f"""
        SELECT coalesce(json_agg(row_to_json(r)), '[]'::json) FROM (
          SELECT p.oid, coalesce((SELECT json_agg(row_to_json(s))
            FROM ci_metrics.plpgsql_profiler_function_statements_tb(p.oid::regprocedure) s),
            '[]'::json) AS statements FROM pg_proc p WHERE p.oid IN ({oid_list})
        ) r;
    """)
    profiles = {row['oid']: row['statements'] for row in json.loads(raw)}
    rows = [{**routine, 'statements': profiles[routine['oid']]} for routine in routines]
    (REPORTS / "plpgsql-profile.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    execute("coverage-export", [sys.executable, str(TESTS / "export_coverage.py"),
                               "--root", str(ROOT), "--profile", str(REPORTS / "plpgsql-profile.json"),
                               "--output", str(REPORTS / "postgresql.xml")])
    print("Relatório: coverage/postgresql.xml", flush=True)


if __name__ == "__main__":
    main()
