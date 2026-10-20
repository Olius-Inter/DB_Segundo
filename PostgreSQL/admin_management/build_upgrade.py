"""Gera uma migração revisável a partir dos blocos canônicos; não conecta ao banco."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def section(name):
    source = (ROOT / name).read_text(encoding="utf-8-sig")
    begin = "-- BEGIN ADMIN_MANAGEMENT"
    end = "-- END ADMIN_MANAGEMENT"
    if source.count(begin) != 1 or source.count(end) != 1:
        raise ValueError("Bloco administrativo ambíguo em " + name)
    return source.split(begin, 1)[1].split(end, 1)[0].strip()


def transaction_body(name):
    source = (ROOT / name).read_text(encoding="utf-8-sig")
    start = source.index("BEGIN;") + len("BEGIN;")
    finish = source.rindex("COMMIT;")
    return source[start:finish].strip()


def main():
    parts = ["""-- OLIUS: atualização administrativa para banco já instalado.
-- Gerado dos scripts canônicos; revisar antes de executar com a conta de implantação.
-- Requer scripts principais, Data Mart, catálogo e controle de acesso anteriores.
BEGIN;
SET LOCAL search_path=public,pg_catalog;
DO $$ BEGIN
    IF to_regclass('public.admin_invitation') IS NOT NULL
       OR to_regclass('public.admin_guard_state') IS NOT NULL THEN
        RAISE EXCEPTION 'Entrega administrativa já presente; conferir a versão antes de reaplicar.';
    END IF;
    IF to_regclass('public.data_catalog_table') IS NULL
       OR to_regprocedure('dm.refresh_data_mart()') IS NULL THEN
        RAISE EXCEPTION 'Instale catálogo, Data Mart e permissões anteriores antes desta atualização.';
    END IF;
END $$;
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;"""]
    for name in ("01_structure.sql", "02_check_constraints.sql", "03_indexes.sql",
                 "04_functions_procedures.sql", "05_triggers.sql"):
        parts.append(section(name))
    # Reaplica as matrizes oficiais em uma única transação, sem copiar sua definição.
    parts.append(transaction_body("data_catalog/04_load.sql"))
    parts.append(transaction_body("access_control/01_roles.sql"))
    parts.append("COMMIT;\n")
    target = Path(__file__).with_name("upgrade.generated.sql")
    target.write_text("\n\n".join(parts), encoding="utf-8")
    print("Migração gerada para revisão:", target)


if __name__ == "__main__":
    main()
