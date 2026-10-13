"""Conquistas e nivel de sustentabilidade.

Modelagem no Redis
------------------
conquistas:{publico}:{id}        ZSET  member = id da conquista
                                       score  = timestamp do desbloqueio
conquista:{id}:portadores        HLL   quantos usuarios distintos tem a conquista
coletas:{publico}:{id}           STR   contador simples de coletas registradas

Por que ZSET e nao SET: o score guarda QUANDO a conquista foi desbloqueada,
entao da pra listar "conquistas recentes" com um ZRANGE sem estrutura extra.
O ZADD usa nx=True para nunca sobrescrever a data original.

O nivel NAO e armazenado. Ele e funcao pura do total acumulado, que ja esta
no ZSET do ranking geral. Guardar o nivel seria duplicar estado e criar a
chance de ele divergir do total.
"""
import time
from dataclasses import dataclass
from datetime import datetime

from .redis_client import redis_client
from .schemas import ConquistaItem, NivelSustentabilidade, Publico

# Limiares de nivel, em litros acumulados. Indice 0 = entrada do nivel 1.
NIVEIS: tuple[float, ...] = (0, 100, 250, 500, 1000, 2000, 5000)


@dataclass(frozen=True)
class Conquista:
    id: str
    titulo: str
    descricao: str
    icone: str
    meta_litros: float | None = None
    meta_coletas: int | None = None


# Catalogo estatico. Mora no codigo porque e regra de negocio, nao dado de
# usuario; o Redis guarda apenas quem desbloqueou o que.
CATALOGO: tuple[Conquista, ...] = (
    Conquista("primeira-coleta", "Primeira Coleta",
              "Voce registrou sua primeira coleta de oleo.", "gota",
              meta_litros=0.1),
    Conquista("50-litros", "Meio Caminho",
              "50 litros de oleo desviados do ralo.", "balde",
              meta_litros=50),
    Conquista("100-litros", "Cem Litros",
              "100 litros coletados. Nivel 2 desbloqueado.", "tambor",
              meta_litros=100),
    Conquista("500-litros", "Guardiao da Agua",
              "500 litros: cerca de 10 milhoes de litros de agua poupados.",
              "escudo", meta_litros=500),
    Conquista("1000-litros", "Mil Litros",
              "Uma tonelada liquida de impacto positivo.", "coroa",
              meta_litros=1000),
    Conquista("constancia-10", "Constancia",
              "10 coletas registradas.", "calendario",
              meta_coletas=10),
    Conquista("constancia-50", "Parceiro Olius",
              "50 coletas registradas.", "selo",
              meta_coletas=50),
)

CATALOGO_POR_ID = {c.id: c for c in CATALOGO}


# --------------------------------------------------------------- niveis


def calcular_nivel(total_litros: float) -> NivelSustentabilidade:
    """Deriva o nivel a partir do total acumulado.

    O card do Figma mostra 'lv. 1', '64L coletados', a barra com '100L' na
    ponta e o texto '100L para o proximo nivel'. Devolvemos meta_nivel (o
    limiar) e faltam (o que resta) para a tela poder usar qualquer um dos dois.
    """
    nivel = 1
    for indice, limiar in enumerate(NIVEIS):
        if total_litros >= limiar:
            nivel = indice + 1

    e_maximo = nivel >= len(NIVEIS)
    if e_maximo:
        base = NIVEIS[-1]
        return NivelSustentabilidade(
            nivel=nivel, total_litros=round(total_litros, 1),
            meta_nivel=base, faltam=0.0, progresso=1.0, e_maximo=True,
        )

    base = NIVEIS[nivel - 1]
    meta = NIVEIS[nivel]
    progresso = (total_litros - base) / (meta - base) if meta > base else 0.0

    return NivelSustentabilidade(
        nivel=nivel,
        total_litros=round(total_litros, 1),
        meta_nivel=meta,
        faltam=round(meta - total_litros, 1),
        progresso=round(min(max(progresso, 0.0), 1.0), 4),
        e_maximo=False,
    )


# ----------------------------------------------------------- desbloqueio


def _atende(conquista: Conquista, total_litros: float, total_coletas: int) -> bool:
    if conquista.meta_litros is not None and total_litros >= conquista.meta_litros:
        return True
    if conquista.meta_coletas is not None and total_coletas >= conquista.meta_coletas:
        return True
    return False


async def avaliar(
    publico: Publico, entidade_id: str, total_litros: float, total_coletas: int
) -> list[ConquistaItem]:
    """Chamado apos cada coleta. Devolve apenas as conquistas NOVAS."""
    chave = f"conquistas:{publico.chave}:{entidade_id}"
    ja_tem = set(await redis_client.zrange(chave, 0, -1))
    agora = int(time.time())

    pendentes = [
        c for c in CATALOGO
        if c.id not in ja_tem and _atende(c, total_litros, total_coletas)
    ]
    if not pendentes:
        return []

    async with redis_client.pipeline(transaction=True) as pipe:
        for c in pendentes:
            # nx=True: se por algum motivo ja existir, preserva a data original.
            pipe.zadd(chave, {c.id: agora}, nx=True)
            # HyperLogLog conta portadores distintos com ~12KB fixos,
            # sem guardar a lista de ids.
            pipe.pfadd(f"conquista:{c.id}:portadores", entidade_id)
        await pipe.execute()

    carimbo = datetime.fromtimestamp(agora).strftime("%Y-%m-%d")
    return [
        ConquistaItem(
            id=c.id, titulo=c.titulo, descricao=c.descricao, icone=c.icone,
            desbloqueada=True, desbloqueada_em=carimbo,
        )
        for c in pendentes
    ]


# -------------------------------------------------------------- listagem


async def listar(
    publico: Publico, entidade_id: str, total_litros: float, total_usuarios: int
) -> list[ConquistaItem]:
    """Catalogo inteiro, com as bloqueadas marcadas para o estado cinza."""
    chave = f"conquistas:{publico.chave}:{entidade_id}"
    desbloqueadas = dict(
        await redis_client.zrange(chave, 0, -1, withscores=True)
    )

    async with redis_client.pipeline(transaction=False) as pipe:
        for c in CATALOGO:
            pipe.pfcount(f"conquista:{c.id}:portadores")
        portadores = await pipe.execute()

    itens: list[ConquistaItem] = []
    for c, qtd in zip(CATALOGO, portadores):
        ts = desbloqueadas.get(c.id)
        itens.append(
            ConquistaItem(
                id=c.id,
                titulo=c.titulo,
                descricao=c.descricao,
                icone=c.icone,
                desbloqueada=ts is not None,
                desbloqueada_em=(
                    datetime.fromtimestamp(ts).strftime("%Y-%m-%d") if ts else None
                ),
                raridade=(
                    round(qtd / total_usuarios, 4) if total_usuarios else None
                ),
            )
        )
    # Desbloqueadas primeiro, na ordem em que foram conquistadas.
    itens.sort(key=lambda i: (not i.desbloqueada, i.desbloqueada_em or ""))
    return itens


async def incrementar_coletas(publico: Publico, entidade_id: str) -> int:
    return await redis_client.incr(f"coletas:{publico.chave}:{entidade_id}")


async def total_coletas(publico: Publico, entidade_id: str) -> int:
    valor = await redis_client.get(f"coletas:{publico.chave}:{entidade_id}")
    return int(valor) if valor else 0