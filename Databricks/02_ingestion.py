"""
===============================================================================
PROJETO.............: ÓLEO AMIGO — OLIUS
AMBIENTE............: DATABRICKS — tarefa Python script com Spark
SCRIPT..............: 02 - Ingestão Completa do Data Mart
===============================================================================
Executar 01_structure.sql antes. Dependências: psycopg[binary], driver JDBC
PostgreSQL e acesso de rede do driver/executores à origem.
Credenciais em secret scope; nenhum segredo deve ser passado em argumentos.
Ver documents/02_execution_guide.md. Ranking fora deste escopo.
"""

import argparse
import json
import logging
import re
import uuid
from decimal import Decimal

DATASETS = {
    "dim_tempo": [
        "data_id"
    ],
    "dim_estabelecimento": [
        "estabelecimento_id"
    ],
    "dim_cidadao": [
        "cidadao_id"
    ],
    "dim_motorista": [
        "motorista_id"
    ],
    "dim_pev": [
        "pev_id"
    ],
    "dim_classificacao_coleta": [
        "classificacao_id"
    ],
    "dim_status_solicitacao": [
        "status_id"
    ],
    "dim_motivo_falha": [
        "motivo_id"
    ],
    "fato_coleta": [
        "coleta_id"
    ],
    "fato_entrega_pev": [
        "entrega_id"
    ],
    "fato_solicitacao": [
        "solicitacao_id"
    ],
    "ponte_coleta_motivo": [
        "coleta_id",
        "motivo_id"
    ]
}

MEASURES = {
    "fato_coleta": [
        "volume_coletado_litros",
        "volume_apresentado_litros",
        "volume_estimado_litros",
        "pontos_nominais",
        "quantidade_coletas"
    ],
    "fato_entrega_pev": [
        "volume_entregue_litros",
        "pontos_nominais",
        "quantidade_entregas"
    ],
    "fato_solicitacao": [
        "volume_estimado_litros",
        "volume_franquia_perdida_litros",
        "vagas_perdidas",
        "quantidade_solicitacoes",
        "quantidade_reagendamentos"
    ]
}

# filho, FK, dimensão/pai, PK
RELATIONS = [
    ("fato_coleta", "data_id", "dim_tempo", "data_id"),
    ("fato_coleta", "estabelecimento_id", "dim_estabelecimento", "estabelecimento_id"),
    ("fato_coleta", "motorista_id", "dim_motorista", "motorista_id"),
    ("fato_coleta", "classificacao_id", "dim_classificacao_coleta", "classificacao_id"),
    ("fato_coleta", "solicitacao_id", "fato_solicitacao", "solicitacao_id"),
    ("fato_entrega_pev", "data_id", "dim_tempo", "data_id"),
    ("fato_entrega_pev", "cidadao_id", "dim_cidadao", "cidadao_id"),
    ("fato_entrega_pev", "pev_id", "dim_pev", "pev_id"),
    ("fato_solicitacao", "data_id", "dim_tempo", "data_id"),
    ("fato_solicitacao", "estabelecimento_id", "dim_estabelecimento", "estabelecimento_id"),
    ("fato_solicitacao", "status_id", "dim_status_solicitacao", "status_id"),
    ("ponte_coleta_motivo", "coleta_id", "fato_coleta", "coleta_id"),
    ("ponte_coleta_motivo", "motivo_id", "dim_motivo_falha", "motivo_id"),
]

LOCK = (71007, 1)
LOG = logging.getLogger("olius.data_mart")


def identifier(value):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise argparse.ArgumentTypeError("Identificador deve conter letras, números ou underscore")
    return value


def parse_args():
    parser = argparse.ArgumentParser(description="Atualiza e publica o Data Mart Olius")
    parser.add_argument("--catalog", required=True, type=identifier)
    parser.add_argument("--pg-host", required=True)
    parser.add_argument("--pg-port", type=int, default=5432)
    parser.add_argument("--pg-database", required=True, type=identifier)
    parser.add_argument("--secret-scope", required=True)
    parser.add_argument("--pg-sslrootcert", help="Arquivo CA acessível ao driver Python")
    parser.add_argument("--jdbc-sslrootcert", help="Arquivo CA acessível em cada executor JDBC")
    parser.add_argument("--query-timeout", type=int, default=600)
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9.-]+", args.pg_host):
        parser.error("--pg-host deve ser um hostname DNS ou IPv4")
    if not 1 <= args.pg_port <= 65535 or args.query_timeout <= 0:
        parser.error("Porta ou timeout inválidos")
    return args


def check_keys(frame, columns, name):
    from pyspark.sql import functions as F
    from functools import reduce

    invalid = reduce(lambda a, b: a | b, (F.col(c).isNull() for c in columns))
    if frame.filter(invalid).limit(1).count():
        raise ValueError(f"{name}: chave nula")
    if frame.groupBy(*columns).count().filter(F.col("count") > 1).limit(1).count():
        raise ValueError(f"{name}: chave duplicada")


def fingerprint(frame, columns):
    from pyspark.sql import functions as F

    expressions = [F.count("*").alias("rows")]
    expressions += [
        F.coalesce(F.sum(F.col(c)), F.lit(0)).alias(c) for c in columns
    ]
    return frame.agg(*expressions).first().asDict()


def verify_fingerprint(expected, actual, name):
    if expected.keys() != actual.keys():
        raise ValueError(f"{name}: contrato de medidas incompatível")
    for key in expected:
        if Decimal(str(expected[key])) != Decimal(str(actual[key])):
            raise ValueError(f"{name}: contagem/total divergente em {key}")


def source_fingerprint(connection, name):
    columns = MEASURES.get(name, [])
    aggregates = ["COUNT(*)"] + [f"COALESCE(SUM({c}), 0)" for c in columns]
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {', '.join(aggregates)} FROM dm.{name}")
        return dict(zip(["rows"] + columns, cursor.fetchone()))


def main():
    import psycopg
    from pyspark.sql import SparkSession, functions as F
    from pyspark.dbutils import DBUtils

    args = parse_args()
    spark = SparkSession.builder.getOrCreate()
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    dbutils = DBUtils(spark)
    # Papéis separados: controlador pode executar o refresh; leitor JDBC só SELECT.
    refresh_user = dbutils.secrets.get(scope=args.secret_scope, key="refresh-user")
    refresh_password = dbutils.secrets.get(scope=args.secret_scope, key="refresh-password")
    read_user = dbutils.secrets.get(scope=args.secret_scope, key="read-user")
    read_password = dbutils.secrets.get(scope=args.secret_scope, key="read-password")

    landing = f"`{args.catalog}`.`olius_bi_landing`"
    control = f"{landing}.`publicacao`"
    # É uma tarefa do Job; não executar duas instalações simultaneamente.
    publication = spark.table(control).collect()
    if len(publication) != 1 or publication[0]["mart"] != "operacoes":
        raise ValueError("Executar 01_structure.sql: publicacao deve ter um único registro")
    previous_batch = publication[0]["lote_id"]
    batch = str(uuid.uuid4())

    options = {
        "host": args.pg_host, "port": args.pg_port, "dbname": args.pg_database,
        "user": refresh_user, "password": refresh_password,
        "sslmode": "verify-full", "connect_timeout": 30,
        "keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10,
        "keepalives_count": 3,
    }
    if args.pg_sslrootcert:
        options["sslrootcert"] = args.pg_sslrootcert
    url = f"jdbc:postgresql://{args.pg_host}:{args.pg_port}/{args.pg_database}"
    counts = {}
    frames = {}
    # Lock de SESSÃO permanece após o commit do refresh e até a publicação.
    # Qualquer outro refresh deve usar dm.refresh_data_mart() e o mesmo lock.
    with psycopg.connect(**options, autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s, %s)", LOCK)
            if not cursor.fetchone()[0]:
                raise RuntimeError("Outra atualização/extração está em andamento")
        try:
            with connection.transaction():
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                    cursor.execute("SET LOCAL statement_timeout = %s" % (args.query_timeout * 1000))
                    cursor.execute("CALL dm.refresh_data_mart()")
            with connection.cursor() as cursor:
                cursor.execute("SELECT snapshot_id::TEXT, refreshed_at FROM dm.refresh_state WHERE singleton")
                snapshot, refreshed = cursor.fetchone()

            for name, keys in DATASETS.items():
                target = f"{landing}.`{name}`"
                target_schema = spark.table(target).drop("_lote_id").schema
                columns = target_schema.fieldNames()
                # Lista explícita baseada no contrato de destino; sem SELECT *.
                reader = (
                    spark.read.format("jdbc")
                    .option("url", url)
                    .option("driver", "org.postgresql.Driver")
                    .option("user", read_user).option("password", read_password)
                    .option("sslmode", "verify-full")
                    .option("queryTimeout", args.query_timeout)
                    .option("fetchsize", 1000)
                    .option("query", f"SELECT {', '.join(columns)} FROM dm.{name}")
                )
                if args.jdbc_sslrootcert:
                    reader = reader.option("sslrootcert", args.jdbc_sslrootcert)
                expected = source_fingerprint(connection, name)
                data = reader.load()
                actual_types = [(f.name, f.dataType) for f in data.schema.fields]
                expected_types = [(f.name, f.dataType) for f in target_schema.fields]
                if actual_types != expected_types:
                    raise ValueError(f"{name}: tipos de origem diferem do contrato Delta")
                # Um lote novo a cada tentativa; tentativas incompletas nunca são publicadas.
                data.withColumn("_lote_id", F.lit(batch)).write.format("delta").mode("append").saveAsTable(target)
                stored = spark.table(target).filter(F.col("_lote_id") == batch).drop("_lote_id")
                check_keys(stored, keys, name)
                verify_fingerprint(expected, fingerprint(stored, MEASURES.get(name, [])), name)
                counts[name] = expected["rows"]
                frames[name] = stored
                LOG.info("Lote %s: %s validado, %s linhas", batch, name, counts[name])

            for child, fk, parent, pk in RELATIONS:
                missing = (
                    frames[child].select(F.col(fk).alias("key")).distinct()
                    .join(frames[parent].select(F.col(pk).alias("key")), "key", "left_anti")
                )
                if missing.limit(1).count():
                    raise ValueError(f"Relacionamento inválido: {child}.{fk} -> {parent}.{pk}")

            for name in ("fato_coleta", "fato_entrega_pev"):
                missing_scores = frames[name].filter(~F.col("calculo_vigente_disponivel")).count()
                if missing_scores:
                    LOG.warning("%s: %s operações sem cálculo vigente; pontos NULL", name, missing_scores)

            with connection.cursor() as cursor:
                cursor.execute("SELECT snapshot_id::TEXT FROM dm.refresh_state WHERE singleton")
                if cursor.fetchone()[0] != snapshot:
                    raise RuntimeError("Origem mudou durante a extração; lote não publicado")
            # Uma única escrita Delta publica o identificador do lote completo.
            # O refresh dos datasets BI deve ocorrer depois desta publicação.
            # Isto não cria transações de leitura entre várias tabelas Delta.
            spark.sql(
                f"""
                UPDATE {control}
                SET lote_id = :batch, snapshot_id = :snapshot,
                    origem_atualizada_em = :refreshed,
                    publicado_em = current_timestamp(), contagens_json = :counts
                WHERE mart = 'operacoes' AND lote_id <=> :previous
                """,
                args={
                    "batch": batch, "snapshot": snapshot, "refreshed": refreshed,
                    "counts": json.dumps(counts, sort_keys=True), "previous": previous_batch,
                },
            )
            current = spark.table(control).collect()
            if len(current) != 1 or current[0]["lote_id"] != batch:
                raise RuntimeError("Publicação concorrente detectada")
            LOG.info("Lote %s publicado, snapshot %s", batch, snapshot)
        finally:
            # Fechar a conexão também libera o lock se houver falha de rede.
            if not connection.closed:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s, %s)", LOCK)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    # Propagar a falha para o Job. Não imprimir credenciais/URLs com senha.
    main()
