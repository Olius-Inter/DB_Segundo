"""Endpoints HTTP. O app mobile so conversa com esta camada."""
import uuid

from fastapi import APIRouter, HTTPException, Query

from . import conquistas as conquistas_service
from . import ranking as ranking_service
from .schemas import (
    ColetaRequest,
    ColetaResponse,
    ConquistasResponse,
    Periodo,
    PerfilRequest,
    Publico,
    RankingResponse,
)

router = APIRouter(prefix="/api")


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

    return ConquistasResponse(
        nivel=conquistas_service.calcular_nivel(total),
        conquistas=await conquistas_service.listar(
            publico, entidade_id, total, participantes
        ),
    )


@router.post("/coletas", response_model=ColetaResponse, response_model_by_alias=True)
async def registrar_coleta(body: ColetaRequest) -> ColetaResponse:
    total = await ranking_service.registrar(body.publico, body.entidade_id, body.litros)
    coletas = await conquistas_service.incrementar_coletas(
        body.publico, body.entidade_id
    )
    novas = await conquistas_service.avaliar(
        body.publico, body.entidade_id, total, coletas
    )

    return ColetaResponse(
        protocolo=uuid.uuid4().hex[:10].upper(),
        status="REGISTRADA",
        total_litros=round(total, 1),
        novas_conquistas=novas,
    )


@router.put("/perfis/{entidade_id}")
async def salvar_perfil(
    entidade_id: str,
    body: PerfilRequest,
    publico: Publico = Query(default=Publico.ESTABELECIMENTO),
) -> dict:
    iniciais = body.iniciais or ranking_service._iniciais(body.nome)
    await ranking_service.salvar_perfil(
        publico, entidade_id, body.nome, body.cidade, iniciais
    )
    return {"status": "ok", "iniciais": iniciais}


@router.post("/ranking/rebuild")
async def rebuild() -> dict:
    """Reconstroi os ZSETs a partir do Postgres.

    O Redis e volatil: a verdade dos dados mora na tabela de coletas. Este
    endpoint existe para responder a pergunta "e se o Redis cair?" antes dela
    ser feita na apresentacao.

    Implemente lendo SUM(litros) agrupado por estabelecimento e periodo e
    chamando ranking_service.registrar para cada linha.
    """
    raise HTTPException(
        status_code=501,
        detail="Conecte o Postgres do projeto principal e popule os ZSETs aqui.",
    )