"""Contratos de entrada e saida da API.

Os campos espelham exatamente o que as telas do Figma precisam desenhar,
para o app nunca ter que fazer duas chamadas ou calcular posicao no cliente.
"""
from enum import Enum

from pydantic import BaseModel, Field


class Publico(str, Enum):
    """Toggle 'Estabelecimento | Cidadao' da tela de ranking."""

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


# ---------------------------------------------------------------- ranking


class RankingItem(BaseModel):
    id: str
    posicao: int
    nome: str
    cidade: str
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


# ------------------------------------------------------------- conquistas


class NivelSustentabilidade(BaseModel):
    """Alimenta o 'Card- nivel de sustentabilidade' do Figma."""

    nivel: int  # "lv. 1"
    total_litros: float = Field(alias="totalLitros")  # "64L coletados"
    meta_nivel: float = Field(alias="metaNivel")  # "100L" na ponta da barra
    faltam: float  # quanto falta ate o proximo nivel
    progresso: float  # 0.0 a 1.0, preenchimento da barra
    e_maximo: bool = Field(alias="eMaximo")

    model_config = {"populate_by_name": True}


class ConquistaItem(BaseModel):
    id: str
    titulo: str
    descricao: str
    icone: str
    desbloqueada: bool
    desbloqueada_em: str | None = Field(default=None, alias="desbloqueadaEm")
    raridade: float | None = None  # fracao de usuarios que possuem

    model_config = {"populate_by_name": True}


class ConquistasResponse(BaseModel):
    nivel: NivelSustentabilidade
    conquistas: list[ConquistaItem]


# ---------------------------------------------------------------- coletas


class ColetaRequest(BaseModel):
    publico: Publico
    entidade_id: str = Field(alias="entidadeId")
    litros: float = Field(gt=0)

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
    cidade: str
    iniciais: str | None = None