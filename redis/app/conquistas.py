"""Niveis de sustentabilidade e conquistas (certificados).

Alinhamento com o 01_structure.sql
----------------------------------
O catalogo de niveis e a tabela `certificate_level` (name, description,
required_liters, badge_image_url). Ela nao e definida aqui: sua descricao
avisa que metas e nomes definitivos estao pendentes e que niveis ficticios
nao devem ser inseridos. O backend principal carrega o catalogo via
PUT /api/niveis e a API apenas o reflete.

Uma conquista desbloqueada e a tabela `certificate`: uma concessao por
estabelecimento e nivel. A FK e fk_certificate_establishment e a regra 11 diz
que B2C nao recebe certificados destinados a estabelecimentos, entao
conquistas existem somente para o publico B2B.

Chaves no Redis
---------------
niveis:catalogo              STRING  JSON do certificate_level, ordenado
conquistas:estab:{id}        ZSET    nivel desbloqueado -> timestamp
conquista:{nivel}:portadores HLL     portadores distintos, para raridade
coletas:sucesso:estab:{id}   STRING  contador de coletas bem-sucedidas

O nivel NAO e armazenado: e funcao pura do total acumulado, que ja esta no
ZSET do ranking geral. Guardar criaria estado duplicado.
"""
import json
import time
from datetime import datetime

from .redis_client import redis_client
from .schemas import (
    ConquistaItem,
    NivelCatalogo,
    NivelSustentabilidade,
    Publico,
)

CHAVE_CATALOGO = "niveis:catalogo"


class PublicoSemConquistas(Exception):
    """Levantada quando se pede conquistas para o publico B2C."""


# =================== catalogo ===================


async def salvar_catalogo(niveis: list[NivelCatalogo]) -> int:
    """Grava o catalogo vindo de certificate_level, ordenado por litros."""
    ordenados = sorted(niveis, key=lambda n: n.litros_requeridos)
    await redis_client.set(
        CHAVE_CATALOGO,
        json.dumps([n.model_dump(by_alias=False) for n in ordenados]),
    )
    return len(ordenados)


async def carregar_catalogo() -> list[NivelCatalogo]:
    """Devolve o catalogo vigente, ou lista vazia se nunca foi carregado."""
    bruto = await redis_client.get(CHAVE_CATALOGO)
    if not bruto:
        return []
    return [NivelCatalogo(**linha) for linha in json.loads(bruto)]


# =================== niveis ===================


def calcular_nivel(
    total_litros: float, catalogo: list[NivelCatalogo]
) -> NivelSustentabilidade:
    """Deriva o nivel a partir do total acumulado e do catalogo real.

    Sem catalogo carregado, devolve configurado=False em vez de inventar
    limiares: a tabela proibe niveis ficticios.
    """
    total = round(total_litros, 1)

    if not catalogo:
        return NivelSustentabilidade(
            nivel=0, nome=None, total_litros=total, meta_nivel=None,
            faltam=None, progresso=0.0, e_maximo=False, configurado=False,
        )

    atingidos = [n for n in catalogo if total >= n.litros_requeridos]
    nivel = len(atingidos)
    nome = atingidos[-1].nome if atingidos else None

    if nivel >= len(catalogo):
        return NivelSustentabilidade(
            nivel=nivel, nome=nome, total_litros=total,
            meta_nivel=catalogo[-1].litros_requeridos, faltam=0.0,
            progresso=1.0, e_maximo=True,
        )

    base = atingidos[-1].litros_requeridos if atingidos else 0.0
    meta = catalogo[nivel].litros_requeridos
    progresso = (total - base) / (meta - base) if meta > base else 0.0

    return NivelSustentabilidade(
        nivel=nivel,
        nome=nome,
        total_litros=total,
        meta_nivel=meta,
        faltam=round(meta - total, 1),
        progresso=round(min(max(progresso, 0.0), 1.0), 4),
        e_maximo=False,
    )


# =================== desbloqueio ===================


def _exige_b2b(publico: Publico) -> None:
    if publico is not Publico.ESTABELECIMENTO:
        raise PublicoSemConquistas(
            "Certificados sao concedidos apenas a estabelecimentos "
            "(fk_certificate_establishment; regra 11)."
        )


async def avaliar(
    publico: Publico, entidade_id: str, total_litros: float
) -> list[ConquistaItem]:
    """Chamado apos cada coleta. Devolve apenas as conquistas NOVAS.

    Para o publico B2C devolve lista vazia em vez de erro: o fluxo de
    registro de entrega continua valido, so nao gera certificado.
    """
    if publico is not Publico.ESTABELECIMENTO:
        return []

    catalogo = await carregar_catalogo()
    if not catalogo:
        return []

    chave = f"conquistas:{publico.chave}:{entidade_id}"
    ja_tem = set(await redis_client.zrange(chave, 0, -1))
    agora = int(time.time())

    pendentes = [
        n for n in catalogo
        if n.id not in ja_tem and total_litros >= n.litros_requeridos
    ]
    if not pendentes:
        return []

    async with redis_client.pipeline(transaction=True) as pipe:
        for n in pendentes:
            # nx=True preserva a data original de uma eventual reavaliacao.
            pipe.zadd(chave, {n.id: agora}, nx=True)
            # HyperLogLog conta portadores distintos com ~12KB fixos.
            pipe.pfadd(f"conquista:{n.id}:portadores", entidade_id)
        await pipe.execute()

    carimbo = datetime.fromtimestamp(agora).strftime("%Y-%m-%d")
    return [
        ConquistaItem(
            id=n.id, titulo=n.nome, descricao=n.descricao,
            badge_image_url=n.badge_image_url,
            litros_requeridos=n.litros_requeridos,
            desbloqueada=True, desbloqueada_em=carimbo,
        )
        for n in pendentes
    ]


async def revogar_acima_de(
    publico: Publico, entidade_id: str, total_litros: float
) -> list[str]:
    """Remove conquistas que o total corrigido nao sustenta mais.

    certificate tem status ACTIVE/REVOKED justamente porque uma correcao
    pode derrubar o volume abaixo da meta. Sem isto, um ajuste negativo
    deixaria o certificado pendurado.
    """
    if publico is not Publico.ESTABELECIMENTO:
        return []

    catalogo = {n.id: n for n in await carregar_catalogo()}
    chave = f"conquistas:{publico.chave}:{entidade_id}"
    atuais = await redis_client.zrange(chave, 0, -1)

    revogar = [
        i for i in atuais
        if i in catalogo and total_litros < catalogo[i].litros_requeridos
    ]
    if revogar:
        await redis_client.zrem(chave, *revogar)
    return revogar


# =================== listagem ===================


async def listar(
    publico: Publico, entidade_id: str, total_litros: float, total_usuarios: int
) -> list[ConquistaItem]:
    """Catalogo inteiro, com as bloqueadas marcadas para o estado cinza."""
    _exige_b2b(publico)

    catalogo = await carregar_catalogo()
    if not catalogo:
        return []

    chave = f"conquistas:{publico.chave}:{entidade_id}"
    desbloqueadas = dict(await redis_client.zrange(chave, 0, -1, withscores=True))

    async with redis_client.pipeline(transaction=False) as pipe:
        for n in catalogo:
            pipe.pfcount(f"conquista:{n.id}:portadores")
        portadores = await pipe.execute()

    itens: list[ConquistaItem] = []
    for n, qtd in zip(catalogo, portadores):
        ts = desbloqueadas.get(n.id)
        itens.append(
            ConquistaItem(
                id=n.id,
                titulo=n.nome,
                descricao=n.descricao,
                badge_image_url=n.badge_image_url,
                litros_requeridos=n.litros_requeridos,
                desbloqueada=ts is not None,
                desbloqueada_em=(
                    datetime.fromtimestamp(ts).strftime("%Y-%m-%d") if ts else None
                ),
                raridade=(round(qtd / total_usuarios, 4) if total_usuarios else None),
            )
        )
    return itens


# ======= contador de coletas (B2B) =============


async def incrementar_sucesso(publico: Publico, entidade_id: str) -> int:
    """Espelha point_calculation.successful_collections_count."""
    return await redis_client.incr(f"coletas:sucesso:{publico.chave}:{entidade_id}")


async def total_sucesso(publico: Publico, entidade_id: str) -> int:
    valor = await redis_client.get(f"coletas:sucesso:{publico.chave}:{entidade_id}")
    return int(valor) if valor else 0