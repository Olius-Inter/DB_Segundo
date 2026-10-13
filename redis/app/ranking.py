"""Ranking de recicladores.

Modelagem no Redis
------------------
ranking:{publico}:{sufixo}   ZSET  member = id da entidade, score = litros
    ranking:estab:2026-08    -> toggle "Este Mes"
    ranking:estab:2026       -> toggle "Este Ano"
    ranking:estab:geral      -> toggle "Geral"
    (o mesmo para cidadao -> 6 chaves no total)

perfil:{publico}:{id}        HASH  nome, cidade, iniciais

ZINCRBY e ZREVRANK sao O(log n): a posicao individual sai sem varrer a lista,
que e justamente o motivo de usar ZSET em vez de ORDER BY no Postgres.
"""
from datetime import date

from .config import settings
from .redis_client import redis_client
from .schemas import (
    MinhaPosicao,
    Periodo,
    Publico,
    RankingItem,
    RankingResponse,
)

MESES_PT = (
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)


def sufixo(periodo: Periodo, hoje: date | None = None) -> str:
    hoje = hoje or date.today()
    if periodo is Periodo.MES:
        return hoje.strftime("%Y-%m")
    if periodo is Periodo.ANO:
        return str(hoje.year)
    return "geral"


def chave(publico: Publico, periodo: Periodo, hoje: date | None = None) -> str:
    return f"ranking:{publico.chave}:{sufixo(periodo, hoje)}"


def rotulo(periodo: Periodo, hoje: date | None = None) -> str:
    """Texto acima do podio: 'Agosto de 2026'."""
    hoje = hoje or date.today()
    if periodo is Periodo.MES:
        return f"{MESES_PT[hoje.month - 1]} de {hoje.year}"
    if periodo is Periodo.ANO:
        return str(hoje.year)
    return "Desde o inicio"


# ----------------------------------------------------------- escrita


async def registrar(publico: Publico, entidade_id: str, litros: float) -> float:
    """Soma a coleta nos tres periodos de uma vez. Devolve o total geral."""
    hoje = date.today()
    chave_mes = chave(publico, Periodo.MES, hoje)
    chave_ano = chave(publico, Periodo.ANO, hoje)
    chave_geral = chave(publico, Periodo.GERAL, hoje)

    async with redis_client.pipeline(transaction=True) as pipe:
        pipe.zincrby(chave_mes, litros, entidade_id)
        pipe.zincrby(chave_ano, litros, entidade_id)
        pipe.zincrby(chave_geral, litros, entidade_id)
        pipe.expire(chave_mes, settings.ttl_mensal)
        resultados = await pipe.execute()

    return float(resultados[2])  # score novo da chave geral


async def salvar_perfil(
    publico: Publico, entidade_id: str, nome: str, cidade: str, iniciais: str
) -> None:
    await redis_client.hset(
        f"perfil:{publico.chave}:{entidade_id}",
        mapping={"nome": nome, "cidade": cidade, "iniciais": iniciais},
    )


# ------------------------------------------------------------ leitura


async def montar(
    publico: Publico,
    periodo: Periodo,
    limite: int,
    meu_id: str | None,
) -> RankingResponse:
    key = chave(publico, periodo)

    # desc=True equivale a ZREVRANGE.
    topo = await redis_client.zrange(key, 0, limite - 1, desc=True, withscores=True)

    metas: list[dict] = []
    if topo:
        async with redis_client.pipeline(transaction=False) as pipe:
            for entidade_id, _ in topo:
                pipe.hgetall(f"perfil:{publico.chave}:{entidade_id}")
            metas = await pipe.execute()

    itens = [
        RankingItem(
            id=entidade_id,
            posicao=posicao,
            nome=meta.get("nome", entidade_id),
            cidade=meta.get("cidade", ""),
            iniciais=meta.get("iniciais") or _iniciais(meta.get("nome", entidade_id)),
            litros=round(float(score), 1),
            voce=(entidade_id == meu_id),
        )
        for posicao, ((entidade_id, score), meta) in enumerate(zip(topo, metas), start=1)
    ]

    minha: MinhaPosicao | None = None
    if meu_id:
        posicao = await redis_client.zrevrank(key, meu_id)
        score = await redis_client.zscore(key, meu_id)
        if posicao is not None and score is not None:
            # ZREVRANK conta a partir de zero: a tela mostra #3, nao #2.
            minha = MinhaPosicao(posicao=posicao + 1, litros=round(float(score), 1))

    return RankingResponse(
        periodo_label=rotulo(periodo),
        minha_posicao=minha,
        itens=itens,
    )


async def total_acumulado(publico: Publico, entidade_id: str) -> float:
    score = await redis_client.zscore(chave(publico, Periodo.GERAL), entidade_id)
    return float(score) if score else 0.0


async def total_participantes(publico: Publico) -> int:
    return await redis_client.zcard(chave(publico, Periodo.GERAL))


def _iniciais(nome: str) -> str:
    """Fallback para o avatar do podio quando o perfil nao traz as iniciais.

    Atencao: no Figma 'Reuters' aparece como 'RT', que nenhuma regra automatica
    produz. As iniciais sao um campo editavel do perfil; isto aqui e so o
    palpite usado quando ninguem preencheu.
    """
    partes = [p for p in nome.split() if p]
    if not partes:
        return "??"
    if len(partes) > 1:
        return (partes[0][0] + partes[-1][0]).upper()

    unica = partes[0]
    # camelCase: "ToKonFome" -> "TK"
    maiusculas = [c for c in unica[1:] if c.isupper()]
    if maiusculas:
        return (unica[0] + maiusculas[0]).upper()
    return unica[:2].upper()