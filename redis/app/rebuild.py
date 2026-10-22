"""Reconstrucao dos ZSETs a partir do PostgreSQL.

O Redis e volatil e o plano gratuito nao tem persistencia. A verdade mora nas
tabelas `collection` (B2B) e `delivery_pev` (B2C); este modulo le as duas e
repopula os seis ZSETs do zero.

Dois filtros que nao podem faltar:

- `record_status = 'RECORDED'`: os dois registros sao corrigiveis e podem ser
  anulados. Somar tudo contaria volume que foi retirado por correcao
  administrativa.
- A data usada e a fisica (`collection_date` / `delivery_date`), nao
  `created_at`, porque e ela que decide em qual mes e ano o volume entra.

Visitas malsucedidas CONTAM: a jornada de coleta manda usar o volume recolhido
vigente, inclusive de visitas malsucedidas, e uma coleta pode ter zero litros.
O ranking mede oleo recolhido, nao visitas realizadas.
"""
import os
from datetime import date

from .redis_client import redis_client
from .schemas import Periodo, Publico
from . import ranking as ranking_service

SQL_B2B = """
SELECT c.establishment_id::text        AS entidade_id,
       c.collected_volume_liters       AS litros,
       c.collection_date               AS data,
       a.city                          AS cidade,
       u.name                          AS nome
  FROM collection c
  JOIN establishment e ON e.id = c.establishment_id
  JOIN users        u ON u.id = e.id
  LEFT JOIN addresses a ON a.id = e.address_id
 WHERE c.record_status = 'RECORDED'
"""

SQL_B2C = """
SELECT d.citizen_id::text  AS entidade_id,
       d.oil_volume_liters AS litros,
       d.delivery_date     AS data,
       NULL                AS cidade,
       u.name              AS nome
  FROM delivery_pev d
  JOIN users u ON u.id = d.citizen_id
 WHERE d.record_status = 'RECORDED'
"""

# certificate_level alimenta tanto o card de nivel quanto a aba Conquistas.
SQL_NIVEIS = """
SELECT id::text, name, description, required_liters, badge_image_url
  FROM certificate_level
 ORDER BY required_liters
"""


class PostgresIndisponivel(Exception):
    """DATABASE_URL ausente ou driver nao instalado."""


def _conectar():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise PostgresIndisponivel(
            "Defina DATABASE_URL apontando para o Postgres do repositorio "
            "principal para habilitar o rebuild."
        )
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover
        raise PostgresIndisponivel(
            "Instale o driver: pip install 'psycopg[binary]'"
        ) from exc
    return psycopg.connect(url)


def _sufixos(data: date) -> list[str]:
    return [data.strftime("%Y-%m"), str(data.year), "geral"]


async def reconstruir() -> dict:
    """Apaga e repopula ranking, perfis e catalogo de niveis."""
    conn = _conectar()
    contagem = {"estabelecimento": 0, "cidadao": 0, "niveis": 0}

    with conn, conn.cursor() as cur:
        # apaga apenas as chaves de ranking e perfil deste projeto
        async for k in redis_client.scan_iter(match="ranking:*", count=500):
            await redis_client.delete(k)
        async for k in redis_client.scan_iter(match="perfil:*", count=500):
            await redis_client.delete(k)

        for publico, sql in (
            (Publico.ESTABELECIMENTO, SQL_B2B),
            (Publico.CIDADAO, SQL_B2C),
        ):
            cur.execute(sql)
            for entidade_id, litros, data, cidade, nome in cur.fetchall():
                dia = data.date() if hasattr(data, "date") else data
                litros = float(litros)

                async with redis_client.pipeline(transaction=False) as pipe:
                    for sufixo in _sufixos(dia):
                        pipe.zincrby(
                            f"ranking:{publico.chave}:{sufixo}", litros, entidade_id
                        )
                    await pipe.execute()

                await ranking_service.salvar_perfil(
                    publico,
                    entidade_id,
                    nome,
                    ranking_service._iniciais(nome),
                    cidade,
                )
                contagem[publico.value] += 1

        cur.execute(SQL_NIVEIS)
        linhas = cur.fetchall()
        contagem["niveis"] = len(linhas)

    return contagem