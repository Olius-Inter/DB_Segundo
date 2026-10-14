"""Contratos de entrada e saida da API.

Os campos espelham o que as telas do Figma precisam desenhar e os nomes das
colunas do 01_structure.sql, para o app nunca ter que fazer duas chamadas nem
calcular posicao no cliente.
"""
from enum import Enum

from pydantic import BaseModel, Field


class Publico(str, Enum):
    """Toggle 'Estabelecimento | Cidadao' da tela de ranking.

    Espelha users.user_type: ESTABLISHMENT e CITIZENS sao especializacoes de
    users, cada uma com PK compartilhada.
    """

    ESTABELECIMENTO = "estabelecimento"
    CIDADAO = "cidadao"

    @property
    def chave(self) -> str:
        """Prefixo curto usado nas chaves do Redis."""
        return "estab" if self is Publico.ESTABELECIMENTO else "cidadao"


class Periodo(str, Enum):
    """Toggle 'Este Mes | Este Ano | Geral' da tela de ranking."""

    MES = "mes"
    ANO = "ano"
    GERAL = "geral"


# =================== ranking ===================


class RankingItem(BaseModel):
    id: str
    posicao: int
    nome: str
    # Cidadaos nao tem endereco no modelo: addresses.owner_kind so admite
    # ESTABLISHMENT ou PEV. Por isso o campo e opcional.
    cidade: str | None = None
    iniciais: str  # avatar do podio: "TK", "DA", "RT"
    litros: float
    voce: bool = False


class MinhaPosicao(BaseModel):
    posicao: int
    litros: float


class RankingResponse(BaseModel):
    periodo_label: str = Field(alias="periodoLabel")  # "Agosto de 2026"
    minha_posicao: MinhaPosicao | None = Field(default=None, alias="minhaPosicao")
    itens: list[RankingItem]

    model_config = {"populate_by_name": True}


# =================== niveis/conquistas ===================


class NivelCatalogo(BaseModel):
    """Uma linha de certificate_level, carregada do Postgres.

    O catalogo NAO e definido aqui. A tabela avisa que metas e nomes
    definitivos estao pendentes e que niveis ficticios nao devem ser
    inseridos, entao a API so reflete o que o backend principal enviar.
    """

    id: str
    nome: str
    descricao: str | None = None
    litros_requeridos: float = Field(alias="litrosRequeridos")
    badge_image_url: str | None = Field(default=None, alias="badgeImageUrl")

    model_config = {"populate_by_name": True}


class CatalogoRequest(BaseModel):
    niveis: list[NivelCatalogo]


class NivelSustentabilidade(BaseModel):
    """Alimenta o 'Card- nivel de sustentabilidade' do Figma."""

    nivel: int  # "lv. 1"; 0 quando ainda nao atingiu o primeiro nivel
    nome: str | None = None  # certificate_level.name do nivel vigente
    total_litros: float = Field(alias="totalLitros")  # "64L coletados"
    meta_nivel: float | None = Field(default=None, alias="metaNivel")
    faltam: float | None = None
    progresso: float  # 0.0 a 1.0, preenchimento da barra
    e_maximo: bool = Field(alias="eMaximo")
    configurado: bool = True  # False quando o catalogo ainda nao foi carregado

    model_config = {"populate_by_name": True}


class ConquistaItem(BaseModel):
    """Um certificate_level e, quando desbloqueado, seu certificate."""

    id: str
    titulo: str
    descricao: str | None = None
    badge_image_url: str | None = Field(default=None, alias="badgeImageUrl")
    litros_requeridos: float = Field(alias="litrosRequeridos")
    desbloqueada: bool
    desbloqueada_em: str | None = Field(default=None, alias="desbloqueadaEm")
    raridade: float | None = None  # fracao de estabelecimentos que possuem

    model_config = {"populate_by_name": True}


class ConquistasResponse(BaseModel):
    nivel: NivelSustentabilidade
    conquistas: list[ConquistaItem]


# =================== coletas ===================


class ColetaRequest(BaseModel):
    """Uma collection (B2B) ou delivery_pev (B2C) recem registrada."""

    publico: Publico
    entidade_id: str = Field(alias="entidadeId")
    litros: float = Field(gt=0)
    # collection.result = SUCCESSFUL. So coletas bem-sucedidas entram no
    # contador, para casar com point_calculation.successful_collections_count.
    sucesso: bool = True

    model_config = {"populate_by_name": True}


class AjusteRequest(BaseModel):
    """Correcao ou anulacao administrativa de um registro ja contabilizado.

    collection e delivery_pev tem record_status, revision, corrected_at e
    correction_reason: um registro pode ser corrigido para menos ou anulado.
    O delta e negativo nesses casos.
    """

    publico: Publico
    entidade_id: str = Field(alias="entidadeId")
    delta_litros: float = Field(alias="deltaLitros")
    motivo: str

    model_config = {"populate_by_name": True}


class ColetaResponse(BaseModel):
    protocolo: str
    status: str
    total_litros: float = Field(alias="totalLitros")
    novas_conquistas: list[ConquistaItem] = Field(
        default_factory=list, alias="novasConquistas"
    )

    model_config = {"populate_by_name": True}


class PerfilRequest(BaseModel):
    nome: str
    cidade: str | None = None
    iniciais: str | None = None