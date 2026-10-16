"""OLIUS — 06 - Exportador externo do Aiven para a Databricks Free Edition.

EXECUTAR FORA DO DATABRICKS, em computador/runner com rede para o Aiven.
Dependências externas: psycopg[binary], pyarrow; CLI Databricks para upload.
Senhas via variáveis de ambiente. Não grava credenciais no manifesto.
"""
import argparse
from datetime import timezone
import importlib.util
import json
import os
from pathlib import Path
import re
import uuid

module_spec = importlib.util.spec_from_file_location(
    "dm_ingestion", Path(__file__).with_name("02_ingestion.py"))
dm = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(dm)
LOCK = (71007, 1)


def arrow_type(sql_type, pa):
    types = {"STRING": pa.string(), "INT": pa.int32(), "BIGINT": pa.int64(),
             "DATE": pa.date32(), "BOOLEAN": pa.bool_(), "TIMESTAMP": pa.timestamp("us", tz="UTC")}
    match = re.fullmatch(r"DECIMAL\((\d+),(\d+)\)", sql_type)
    return pa.decimal128(int(match[1]), int(match[2])) if match else types[sql_type]


def main():
    import psycopg
    from psycopg import sql
    import pyarrow as pa
    import pyarrow.parquet as pq

    parser = argparse.ArgumentParser()
    parser.add_argument("--pg-host", required=True)
    parser.add_argument("--pg-port", type=int, required=True)
    parser.add_argument("--pg-database", required=True)
    parser.add_argument("--sslrootcert", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--chunk-size", type=int, default=10000)
    args = parser.parse_args()
    if args.chunk_size <= 0 or not 1 <= args.pg_port <= 65535:
        parser.error("Tamanho de bloco/porta inválidos")
    shared = dict(host=args.pg_host, port=args.pg_port, dbname=args.pg_database,
                  sslmode="verify-full", sslrootcert=args.sslrootcert,
                  connect_timeout=30, keepalives=1, keepalives_idle=30,
                  keepalives_interval=10, keepalives_count=3)
    reader_credentials = dict(user=os.environ["OLIUS_BI_READ_USER"],
                              password=os.environ["OLIUS_BI_READ_PASSWORD"])
    refresh_credentials = dict(user=os.environ["OLIUS_BI_REFRESH_USER"],
                               password=os.environ["OLIUS_BI_REFRESH_PASSWORD"])
    export_id = str(uuid.uuid4())
    root = Path(args.output_root).resolve() / export_id
    root.mkdir(parents=True, exist_ok=False)
    manifest = {"contract_version": dm.CONTRACT["version"],
                "export_id": export_id, "datasets": {}}
    with psycopg.connect(**shared, **refresh_credentials, autocommit=True) as control:
        with control.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s,%s)", LOCK)
            if not cursor.fetchone()[0]:
                raise RuntimeError("Outro refresh/export está em andamento")
        # Fechar a sessão libera o lock em caso de erro. Ele fica retido no export.
        with control.transaction():
            control.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            control.execute("CALL dm.refresh_data_mart()")
        snapshot, refreshed = control.execute(
            "SELECT snapshot_id::TEXT,refreshed_at FROM dm.refresh_state WHERE singleton"
        ).fetchone()
        manifest.update(snapshot_id=snapshot,
                        refreshed_at=refreshed.astimezone(timezone.utc).isoformat())

        with psycopg.connect(**shared, **reader_credentials) as connection:
            connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            visible = connection.execute(
                "SELECT snapshot_id::TEXT FROM dm.refresh_state WHERE singleton").fetchone()[0]
            if visible != snapshot:
                raise RuntimeError("Snapshot de leitura diferente do refresh")
            for name, spec in dm.CONTRACT["datasets"].items():
                columns = list(spec["columns"])
                schema = pa.schema([(c, arrow_type(t, pa)) for c, t in spec["columns"].items()])
                directory = root / name
                directory.mkdir()
                aggregates = [sql.SQL("COUNT(*)")] + [
                    sql.SQL("COALESCE(SUM({}),0)").format(sql.Identifier(c)) for c in spec["measures"]]
                values = connection.execute(sql.SQL("SELECT {} FROM dm.{}").format(
                    sql.SQL(", ").join(aggregates), sql.Identifier(name))).fetchone()
                totals = dict(zip(["rows"] + spec["measures"], values))
                metadata = {"fingerprint": {k: str(v) for k, v in totals.items()}, "files": []}
                written = 0
                with connection.cursor(name="export_" + name) as cursor:
                    cursor.execute(sql.SQL("SELECT {} FROM dm.{}").format(
                        sql.SQL(", ").join(map(sql.Identifier, columns)), sql.Identifier(name)))
                    number = 0
                    while True:
                        rows = cursor.fetchmany(args.chunk_size)
                        if not rows and number:
                            break
                        # Mesmo um conjunto vazio tem Parquet com schema explícito.
                        table = pa.Table.from_pylist([dict(zip(columns, row)) for row in rows], schema=schema)
                        path = directory / f"part-{number:05d}.parquet"
                        pq.write_table(table, path, compression="snappy")
                        metadata["files"].append({"name": path.name, "bytes": path.stat().st_size,
                                                  "sha256": dm.sha256(path)})
                        written += len(rows)
                        number += 1
                        if not rows:
                            break
                if written != totals["rows"]:
                    raise ValueError(f"{name}: contagem exportada divergente")
                manifest["datasets"][name] = metadata
            # Conexão de controle deve continuar viva até terminar a leitura.
            if control.execute("SELECT snapshot_id::TEXT FROM dm.refresh_state WHERE singleton").fetchone()[0] != snapshot:
                raise RuntimeError("Snapshot mudou durante o export")

    # Manifesto escrito por último: pasta parcial não é um lote pronto.
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Snapshot pronto: {root}")
    print("Envie os Parquets para o Volume e o manifest.json por último.")


if __name__ == "__main__":
    main()
