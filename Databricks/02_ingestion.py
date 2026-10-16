"""
OLIUS — 02 - Ingestão do Data Mart — Databricks Free Edition / serverless.
Lê um snapshot Parquet já enviado ao Volume; não conecta ao Aiven.
Instalar 01_structure.sql e 03_views.sql antes. Ver documents/02_execution_guide.md.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
from functools import reduce
import hashlib
import json
import logging
from pathlib import Path
import re
import uuid

CONTRACT = json.loads(Path(__file__).with_name("05_data_contract.json").read_text(encoding="utf-8"))
DATASETS = {name: spec["keys"] for name, spec in CONTRACT["datasets"].items()}
MEASURES = {name: spec["measures"] for name, spec in CONTRACT["datasets"].items() if spec["measures"]}
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
LOG = logging.getLogger("olius.data_mart")


def identifier(value):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise argparse.ArgumentTypeError("Identificador inválido")
    return value


def verify_fingerprint(expected, actual, name):
    if expected.keys() != actual.keys():
        raise ValueError(f"{name}: contrato de medidas incompatível")
    for key in expected:
        if Decimal(str(expected[key])) != Decimal(str(actual[key])):
            raise ValueError(f"{name}: contagem/total divergente em {key}")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_manifest(root, manifest):
    if manifest.get("contract_version") != CONTRACT["version"]:
        raise ValueError("Versão do contrato incompatível")
    uuid.UUID(manifest["snapshot_id"])
    uuid.UUID(manifest["export_id"])
    if set(manifest["datasets"]) != set(DATASETS):
        raise ValueError("Manifesto não contém exatamente todos os conjuntos")
    if not datetime.fromisoformat(manifest["refreshed_at"]).tzinfo:
        raise ValueError("Horário do snapshot deve ter fuso")
    for name, metadata in manifest["datasets"].items():
        files = metadata["files"]
        if not files or len({f["name"] for f in files}) != len(files):
            raise ValueError(f"{name}: lista de arquivos vazia/duplicada")
        for item in files:
            if not re.fullmatch(r"part-[0-9]+\.parquet", item["name"]):
                raise ValueError("Nome de arquivo fora do contrato")
            path = root / name / item["name"]
            if not path.is_file() or path.is_symlink():
                raise ValueError(f"{name}: upload incompleto")
            if path.stat().st_size != item["bytes"] or sha256(path) != item["sha256"]:
                raise ValueError(f"{name}: conteúdo divergente/incompleto")
        expected_keys = {"rows", *MEASURES.get(name, [])}
        if set(metadata["fingerprint"]) != expected_keys:
            raise ValueError(f"{name}: medidas do manifesto incompatíveis")


def fingerprint(frame, columns):
    from pyspark.sql import functions as F
    return frame.agg(F.count("*").alias("rows"), *[
        F.coalesce(F.sum(F.col(c)), F.lit(0)).alias(c) for c in columns
    ]).first().asDict()


def check_keys(frame, columns, name):
    from pyspark.sql import functions as F
    invalid = reduce(lambda a, b: a | b, (F.col(c).isNull() for c in columns))
    if frame.filter(invalid).limit(1).count():
        raise ValueError(f"{name}: chave nula")
    if frame.groupBy(*columns).count().filter(F.col("count") > 1).limit(1).count():
        raise ValueError(f"{name}: chave duplicada")


def main():
    from pyspark.sql import SparkSession, functions as F
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=identifier)
    parser.add_argument("--snapshot-path", required=True, help="/Volumes/.../<export_id>")
    args = parser.parse_args()
    root = Path(args.snapshot_path)
    expected_root = Path("/Volumes") / args.catalog / "olius_bi_landing" / "snapshots"
    if root.parent != expected_root or root.name in (".", ".."):
        raise ValueError("Snapshot deve estar no Volume criado por 01_structure.sql")
    uuid.UUID(root.name)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if root.name != manifest["export_id"]:
        raise ValueError("Pasta e export_id não coincidem")
    validate_manifest(root, manifest)

    spark = SparkSession.builder.getOrCreate()
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    landing = f"`{args.catalog}`.`olius_bi_landing`"
    control = f"{landing}.`publicacao`"
    publication = spark.table(control).collect()
    if len(publication) != 1 or publication[0]["mart"] != "operacoes":
        raise ValueError("Controle de publicação incompatível")
    previous = publication[0]
    if previous["snapshot_id"] == manifest["snapshot_id"]:
        LOG.info("Snapshot já publicado: nada a duplicar")
        return
    refreshed = datetime.fromisoformat(manifest["refreshed_at"]).astimezone(timezone.utc)
    if previous["origem_atualizada_em"] is not None:
        old = previous["origem_atualizada_em"].replace(tzinfo=timezone.utc)
        if refreshed <= old:
            raise ValueError("Não publicar snapshot mais antigo que o ativo")

    batch = str(uuid.uuid4())
    frames, counts = {}, {}
    for name, keys in DATASETS.items():
        spec = CONTRACT["datasets"][name]
        target = f"{landing}.`{name}`"
        data = spark.read.parquet(*[
            str(root / name / item["name"]) for item in manifest["datasets"][name]["files"]
        ])
        target_schema = spark.table(target).drop("_lote_id").schema
        expected_types = [(f.name, f.dataType) for f in target_schema.fields]
        actual_types = [(f.name, f.dataType) for f in data.schema.fields]
        if list(spec["columns"]) != data.columns or actual_types != expected_types:
            raise ValueError(f"{name}: schema Parquet/Delta incompatível")
        data.withColumn("_lote_id", F.lit(batch)).write.format("delta").mode("append").saveAsTable(target)
        stored = spark.table(target).filter(F.col("_lote_id") == batch).drop("_lote_id")
        check_keys(stored, keys, name)
        verify_fingerprint(manifest["datasets"][name]["fingerprint"],
                           fingerprint(stored, MEASURES.get(name, [])), name)
        frames[name] = stored
        counts[name] = manifest["datasets"][name]["fingerprint"]["rows"]

    for child, fk, parent, pk in RELATIONS:
        missing = frames[child].select(F.col(fk).alias("key")).distinct().join(
            frames[parent].select(F.col(pk).alias("key")), "key", "left_anti")
        if missing.limit(1).count():
            raise ValueError(f"Relacionamento inválido: {child}.{fk}")
    ranking = frames["ranking_anual"]
    if ranking.filter(~F.col("perfil").isin("B2B", "B2C") | (F.col("posicao") < 1)
                      | F.col("pontos_anuais").isNull() | F.col("posicao").isNull()).limit(1).count():
        raise ValueError("Ranking contém perfil/posição/pontos inválidos")
    for profile, dim, key in [("B2B", "dim_estabelecimento", "estabelecimento_id"),
                              ("B2C", "dim_cidadao", "cidadao_id")]:
        missing = ranking.filter(F.col("perfil") == profile).select(
            F.col("participante_id").alias("key")).join(
            frames[dim].select(F.col(key).alias("key")), "key", "left_anti")
        if missing.limit(1).count():
            raise ValueError("Participante do ranking não tem dimensão")

    # Único escritor/uma execução simultânea; publicação não torna leituras
    # multi-table transacionais. Atualizar datasets do dashboard depois do Job.
    spark.sql(f"""
        UPDATE {control}
        SET lote_id=:batch, snapshot_id=:snapshot, origem_atualizada_em=:refreshed,
            publicado_em=current_timestamp(), contagens_json=:counts
        WHERE mart='operacoes' AND lote_id <=> :previous
    """, args={"batch": batch, "snapshot": manifest["snapshot_id"],
               "refreshed": refreshed, "counts": json.dumps(counts, sort_keys=True),
               "previous": previous["lote_id"]})
    active = spark.table(control).collect()
    if len(active) != 1 or active[0]["lote_id"] != batch:
        raise RuntimeError("Publicação concorrente detectada")
    LOG.info("Lote %s publicado com %s conjuntos", batch, len(DATASETS))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    main()
