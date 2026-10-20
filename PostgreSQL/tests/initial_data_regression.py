"""Regressão real da carga oficial em um banco criado e descartado pelo teste."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess

import run_ci


DATABASE = "olius_reference_regression"
ROOT = Path(__file__).resolve().parents[2]


def execute(sql=None, relative=None, *, base=False, fails=False):
    args = run_ci.command()
    if not base:
        if "-d" in args:
            args[args.index("-d") + 1] = DATABASE
        else:
            args.extend(["-d", DATABASE])
    args.append("-qAt")
    if relative:
        path = "/workspace/" + relative if os.environ.get("OLIUS_TEST_DOCKER_CONTAINER") else str(ROOT / relative)
        args.extend(["-f", path])
    result = subprocess.run(args, input=sql, capture_output=True, text=True,
                            encoding="utf-8", timeout=120, cwd=ROOT)
    if fails:
        if result.returncode == 0:
            raise AssertionError("Esperava recusa da carga/validação, mas houve sucesso.")
    elif result.returncode:
        raise RuntimeError(result.stderr[-6000:])
    return result.stdout.strip()


def verify(condition, explanation):
    if execute("SELECT " + condition) != "t":
        raise AssertionError(explanation)


def snapshot():
    return execute("""SELECT jsonb_build_array(
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.subscription_plan t),
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.certificate_level t),
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.establishment_type t),
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.collection_failure_reason t),
        (SELECT count(*) FROM public.subscription_plan_log),
        (SELECT count(*) FROM public.certificate_level_log),
        (SELECT count(*) FROM public.collection_failure_reason_log));""")


def check_reference_data():
    load = "PostgreSQL/initial_data/01_reference_data.sql"
    validate = "PostgreSQL/initial_data/02_validate.sql"
    execute(relative=validate, fails=True)
    # Duas implantações na base vazia devem serializar sem duplicar os catálogos.
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: execute(relative=load), range(2)))
    execute(relative=validate)
    verify("(SELECT count(*) FROM public.subscription_plan)=3 AND "
           "(SELECT count(*) FROM public.certificate_level)=3 AND "
           "(SELECT count(*) FROM public.establishment_type)=7 AND "
           "(SELECT count(*) FROM public.collection_failure_reason)=3", "16 referências oficiais")
    verify("NOT EXISTS(SELECT 1 FROM public.users) AND NOT EXISTS(SELECT 1 FROM public.collection) "
           "AND NOT EXISTS(SELECT 1 FROM public.certificate)", "sem usuários, coletas ou concessões fictícias")
    before = snapshot()
    execute(relative=load)
    execute(relative=validate)
    if before != snapshot():
        raise AssertionError("Reexecução alterou IDs, timestamps, valores ou quantidade de logs.")

    # IDs antigos compatíveis são preservados, inclusive sem UNIQUE no nome do nível.
    execute("""UPDATE public.certificate_level SET id=gen_random_uuid()
               WHERE name='Óleo Amigo — Bronze';
               INSERT INTO public.establishment_type(name) VALUES ('Categoria adicional legítima');""")
    before = snapshot()
    execute(relative=load)
    execute(relative=validate)
    if before != snapshot():
        raise AssertionError("Carga alterou registro preexistente ou categoria adicional.")

    # A falha no plano ocorre após a tentativa de reinserir Outro: tudo deve voltar.
    execute("""UPDATE public.subscription_plan SET monthly_price=20 WHERE name='Plano Básico';
               DELETE FROM public.establishment_type WHERE name='Outro';""")
    before = snapshot()
    execute(relative=load, fails=True)
    execute(relative=validate, fails=True)
    if before != snapshot():
        raise AssertionError("Divergência deixou uma carga parcial ou sobrescreveu dados.")
    execute("UPDATE public.subscription_plan SET monthly_price=19.90 WHERE name='Plano Básico';")
    execute(relative=load)

    execute("""INSERT INTO public.certificate_level(name,required_liters)
               VALUES ('Óleo Amigo — Ouro',1000);""")
    before = snapshot()
    execute(relative=load, fails=True)
    execute(relative=validate, fails=True)
    if before != snapshot():
        raise AssertionError("Nome de certificado ambíguo não preservou o estado original.")
    print("PASS: initial-data (16 registros, concorrência, reexecução sem escrita, IDs existentes, extras, conflitos e rollback)")


def main():
    if os.environ.get("OLIUS_CI_DISPOSABLE") != "1":
        raise RuntimeError("Regressão exige OLIUS_CI_DISPOSABLE=1 em servidor de teste descartável.")
    if execute("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='olius_reference_regression');", base=True) != "f":
        raise RuntimeError("Banco de regressão já existe; nenhum banco preexistente será removido.")
    execute("CREATE DATABASE olius_reference_regression;", base=True)
    try:
        for name in ("01_structure.sql", "02_check_constraints.sql", "03_indexes.sql",
                     "04_functions_procedures.sql", "05_triggers.sql"):
            execute(relative="PostgreSQL/" + name)
        check_reference_data()
    finally:
        execute("DROP DATABASE olius_reference_regression WITH (FORCE);", base=True)


if __name__ == "__main__":
    main()
