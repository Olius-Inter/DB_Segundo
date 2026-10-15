"""Testes internos. Rodam contra um Redis falso, em memoria.

Nao tocam no Redis Cloud, nao gastam cota e nao sujam o banco da
apresentacao. Rode estes ANTES de qualquer teste com o banco real.

    pytest -v
"""
import fakeredis.aioredis
import pytest
import pytest_asyncio

from app import conquistas as conquistas_service
from app import ranking as ranking_service
from app.conquistas import PublicoSemConquistas
from app.schemas import NivelCatalogo, Periodo, Publico

CATALOGO = [
    NivelCatalogo(id="n-01", nome="Semente", litros_requeridos=50),
    NivelCatalogo(id="n-02", nome="Broto", litros_requeridos=100),
    NivelCatalogo(id="n-03", nome="Arvore", litros_requeridos=250),
]


@pytest_asyncio.fixture
async def redis_falso(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(ranking_service, "redis_client", fake)
    monkeypatch.setattr(conquistas_service, "redis_client", fake)
    yield fake
    await fake.aclose()


# --------------------------------------------------------------- niveis


def test_sem_catalogo_nao_inventa_niveis():
    """certificate_level proibe niveis ficticios."""
    nivel = conquistas_service.calcular_nivel(64, [])
    assert nivel.configurado is False
    assert nivel.nivel == 0
    assert nivel.meta_nivel is None


def test_nivel_do_card_do_figma():
    """64L com meta de 100L: lv.1, faltam 36, barra em 64%."""
    nivel = conquistas_service.calcular_nivel(64, CATALOGO)
    assert nivel.nivel == 1
    assert nivel.nome == "Semente"
    assert nivel.meta_nivel == 100
    assert nivel.faltam == 36
    assert nivel.progresso == pytest.approx(0.2800, abs=1e-4)


def test_nivel_sobe_no_limiar_exato():
    assert conquistas_service.calcular_nivel(49.9, CATALOGO).nivel == 0
    assert conquistas_service.calcular_nivel(50, CATALOGO).nivel == 1
    assert conquistas_service.calcular_nivel(250, CATALOGO).nivel == 3


def test_nivel_maximo_nao_estoura():
    nivel = conquistas_service.calcular_nivel(999_999, CATALOGO)
    assert nivel.e_maximo is True
    assert nivel.progresso == 1.0


@pytest.mark.asyncio
async def test_catalogo_fica_ordenado_por_litros(redis_falso):
    await conquistas_service.salvar_catalogo(list(reversed(CATALOGO)))
    lido = await conquistas_service.carregar_catalogo()
    assert [n.litros_requeridos for n in lido] == [50, 100, 250]


# -------------------------------------------------------------- ranking


@pytest.mark.asyncio
async def test_ordem_e_posicao(redis_falso):
    P = Publico.ESTABELECIMENTO
    dados = [("e1", "ToKonFome", 120), ("e2", "Dogao", 90), ("e3", "Reuters", 60)]
    for id_, nome, litros in dados:
        await ranking_service.salvar_perfil(P, id_, nome, nome[:2].upper(), "Osasco")
        await ranking_service.registrar(P, id_, litros)

    r = await ranking_service.montar(P, Periodo.MES, 10, meu_id="e3")

    assert [i.nome for i in r.itens] == ["ToKonFome", "Dogao", "Reuters"]
    assert [i.posicao for i in r.itens] == [1, 2, 3]
    # ZREVRANK conta do zero; a tela precisa ver #3, nao #2.
    assert r.minha_posicao.posicao == 3
    assert [i.voce for i in r.itens] == [False, False, True]


@pytest.mark.asyncio
async def test_cidadao_sem_cidade(redis_falso):
    """addresses.owner_kind nao admite CITIZENS."""
    P = Publico.CIDADAO
    await ranking_service.salvar_perfil(P, "c1", "Maria Silva", "MS")
    await ranking_service.registrar(P, "c1", 18)
    r = await ranking_service.montar(P, Periodo.MES, 10, None)
    assert r.itens[0].cidade is None


@pytest.mark.asyncio
async def test_coletas_somam_em_vez_de_substituir(redis_falso):
    P = Publico.CIDADAO
    await ranking_service.registrar(P, "c1", 10)
    assert await ranking_service.registrar(P, "c1", 5) == 15.0


@pytest.mark.asyncio
async def test_publicos_nao_se_misturam(redis_falso):
    await ranking_service.registrar(Publico.ESTABELECIMENTO, "e1", 100)
    r = await ranking_service.montar(Publico.CIDADAO, Periodo.MES, 10, None)
    assert r.itens == []


@pytest.mark.asyncio
async def test_usuario_fora_do_ranking_nao_quebra(redis_falso):
    await ranking_service.registrar(Publico.ESTABELECIMENTO, "e1", 10)
    r = await ranking_service.montar(
        Publico.ESTABELECIMENTO, Periodo.MES, 10, meu_id="nao-existe"
    )
    assert r.minha_posicao is None


def test_iniciais_do_avatar():
    assert ranking_service._iniciais("Dogao do Adriano") == "DA"
    assert ranking_service._iniciais("ToKonFome") == "TK"


# -------------------------------------------------------------- ajustes


@pytest.mark.asyncio
async def test_correcao_reduz_o_total(redis_falso):
    """collection.record_status permite anular um registro."""
    P = Publico.ESTABELECIMENTO
    await ranking_service.registrar(P, "e1", 120)
    total = await ranking_service.ajustar(P, "e1", -20)
    assert total == 100.0


@pytest.mark.asyncio
async def test_ajuste_nao_deixa_total_negativo(redis_falso):
    P = Publico.ESTABELECIMENTO
    await ranking_service.registrar(P, "e1", 10)
    assert await ranking_service.ajustar(P, "e1", -50) == 0.0


@pytest.mark.asyncio
async def test_conquista_revogada_quando_total_cai(redis_falso):
    P = Publico.ESTABELECIMENTO
    await conquistas_service.salvar_catalogo(CATALOGO)
    await ranking_service.registrar(P, "e1", 120)
    await conquistas_service.avaliar(P, "e1", 120)

    # 120 -> 80: ainda sustenta Semente (50), nao mais Broto (100).
    total = await ranking_service.ajustar(P, "e1", -40)
    revogadas = await conquistas_service.revogar_acima_de(P, "e1", total)

    assert "n-02" in revogadas
    itens = await conquistas_service.listar(P, "e1", total, 1)
    assert {i.id for i in itens if i.desbloqueada} == {"n-01"}


# ----------------------------------------------------------- conquistas


@pytest.mark.asyncio
async def test_conquistas_vem_do_catalogo(redis_falso):
    P = Publico.ESTABELECIMENTO
    await conquistas_service.salvar_catalogo(CATALOGO)
    novas = await conquistas_service.avaliar(P, "e1", 120)
    assert {c.id for c in novas} == {"n-01", "n-02"}


@pytest.mark.asyncio
async def test_sem_catalogo_nao_desbloqueia_nada(redis_falso):
    novas = await conquistas_service.avaliar(Publico.ESTABELECIMENTO, "e1", 9999)
    assert novas == []


@pytest.mark.asyncio
async def test_conquista_nao_desbloqueia_duas_vezes(redis_falso):
    P = Publico.ESTABELECIMENTO
    await conquistas_service.salvar_catalogo(CATALOGO)
    primeira = await conquistas_service.avaliar(P, "e1", 60)
    segunda = await conquistas_service.avaliar(P, "e1", 60)
    assert len(primeira) == 1
    assert segunda == []  # idempotente


@pytest.mark.asyncio
async def test_cidadao_nao_recebe_certificado(redis_falso):
    """fk_certificate_establishment e regra 11: B2C fica de fora."""
    await conquistas_service.salvar_catalogo(CATALOGO)
    assert await conquistas_service.avaliar(Publico.CIDADAO, "c1", 9999) == []

    with pytest.raises(PublicoSemConquistas):
        await conquistas_service.listar(Publico.CIDADAO, "c1", 9999, 1)


@pytest.mark.asyncio
async def test_listagem_traz_bloqueadas_tambem(redis_falso):
    P = Publico.ESTABELECIMENTO
    await conquistas_service.salvar_catalogo(CATALOGO)
    await conquistas_service.avaliar(P, "e1", 60)

    itens = await conquistas_service.listar(P, "e1", 60, total_usuarios=1)
    assert len(itens) == len(CATALOGO)
    assert sum(1 for i in itens if i.desbloqueada) == 1


@pytest.mark.asyncio
async def test_contador_so_conta_sucesso(redis_falso):
    """Espelha point_calculation.successful_collections_count."""
    P = Publico.ESTABELECIMENTO
    await conquistas_service.incrementar_sucesso(P, "e1")
    await conquistas_service.incrementar_sucesso(P, "e1")
    assert await conquistas_service.total_sucesso(P, "e1") == 2