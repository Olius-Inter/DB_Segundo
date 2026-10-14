"""Endpoints HTTP. O app mobile so conversa com esta camada."""
import uuid

from fastapi import APIRouter, HTTPException, Query

from . import conquistas as conquistas_service
from . import ranking as ranking_service
from . import rebuild as rebuild_service
from .conquistas import PublicoSemConquistas
from .schemas import (
    AjusteRequest,
    CatalogoRequest,
    ColetaRequest,
    ColetaResponse,
    ConquistasResponse,
    Periodo,
    PerfilRequest,
    Publico,
    RankingResponse,
)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------- ranking


@router.get("/ranking", response_model=RankingResponse, response_model_by_alias=True)
async def obter_ranking(
    publico: Publico = Query(default=Publico.ESTABELECIMENTO),
    periodo: Periodo = Query(default=Periodo.MES),
    limite: int = Query(default=10, ge=1, le=100),
    # Em producao este id sai do token de autenticacao, nunca da query string:
    # caso contrario qualquer um consulta a posicao alheia.
    meu_id: str | None = Query(default=None, alias="meuId"),
) -> RankingResponse:
    return await ranking_service.montar(publico, periodo, limite, meu_id)


@router.put("/perfis/{entidade_id}")
async def salvar_perfil(
    entidade_id: str,
    body: PerfilRequest,
    publico: Publico = Query(default=Publico.ESTABELECIMENTO),
) -> dict:
    iniciais = body.iniciais or ranking_service._iniciais(body.nome)
    await ranking_service.salvar_perfil(
        publico, entidade_id, body.nome, iniciais, body.cidade
    )
    return {"status": "ok", "iniciais": iniciais}


# ------------------------------------------------------- niveis/conquistas


@router.put("/niveis")
async def carregar_niveis(body: CatalogoRequest) -> dict:
    """Carrega o catalogo a partir de certificate_level.

    Chamado pelo backend principal. A API nao define niveis por conta
    propria: a tabela avisa que metas e nomes definitivos estao pendentes.
    """
    total = await conquistas_service.salvar_catalogo(body.niveis)
    return {"status": "ok", "niveis": total}


@router.get("/niveis")
async def listar_niveis() -> dict:
    catalogo = await conquistas_service.carregar_catalogo()
    return {
        "configurado": bool(catalogo),
        "niveis": [n.model_dump(by_alias=True) for n in catalogo],
    }


@router.get(
    "/conquistas/{entidade_id}",
    response_model=ConquistasResponse,
    response_model_by_alias=True,
)
async def obter_conquistas(
    entidade_id: str,
    publico: Publico = Query(default=Publico.ESTABELECIMENTO),
) -> ConquistasResponse:
    total = await ranking_service.total_acumulado(publico, entidade_id)
    participantes = await ranking_service.total_participantes(publico)
    catalogo = await conquistas_service.carregar_catalogo()

    try:
        itens = await conquistas_service.listar(
            publico, entidade_id, total, participantes
        )
    except PublicoSemConquistas as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ConquistasResponse(
        nivel=conquistas_service.calcular_nivel(total, catalogo),
        conquistas=itens,
    )


# ---------------------------------------------------------------- coletas


@router.post("/coletas", response_model=ColetaResponse, response_model_by_alias=True)
async def registrar_coleta(body: ColetaRequest) -> ColetaResponse:
    total = await ranking_service.registrar(body.publico, body.entidade_id, body.litros)

    if body.sucesso:
        await conquistas_service.incrementar_sucesso(body.publico, body.entidade_id)

    novas = await conquistas_service.avaliar(body.publico, body.entidade_id, total)

    return ColetaResponse(
        protocolo=uuid.uuid4().hex[:10].upper(),
        status="REGISTRADA",
        total_litros=round(total, 1),
        novas_conquistas=novas,
    )


@router.post("/coletas/ajuste", response_model=ColetaResponse, response_model_by_alias=True)
async def ajustar_coleta(body: AjusteRequest) -> ColetaResponse:
    """Correcao ou anulacao de um registro ja contabilizado.

    delta_litros negativo reduz o acumulado. Conquistas que o novo total nao
    sustenta mais sao revogadas, como certificate.status = REVOKED.
    """
    total = await ranking_service.ajustar(
        body.publico, body.entidade_id, body.delta_litros
    )
    await conquistas_service.revogar_acima_de(body.publico, body.entidade_id, total)

    return ColetaResponse(
        protocolo=uuid.uuid4().hex[:10].upper(),
        status="AJUSTADA",
        total_litros=round(total, 1),
        novas_conquistas=[],
    )


# ---------------------------------------------------------------- rebuild


@router.post("/ranking/rebuild")
async def rebuild() -> dict:
    """Reconstroi os ZSETs a partir de collection e delivery_pev."""
    try:
        return await rebuild_service.reconstruir()
    except rebuild_service.PostgresIndisponivel as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc