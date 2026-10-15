"""Popula o Redis com os dados de exemplo das telas do Figma.

Uso:
    python -m scripts.seed          # insere
    python -m scripts.seed --limpar # apaga tudo antes de inserir

Rode uma vez depois de configurar o .env, senao o app abre com o ranking
vazio. Os valores sao os mesmos que aparecem no prototipo.

ATENCAO: os niveis abaixo sao placeholders de demonstracao. Em producao o
catalogo vem de certificate_level via PUT /api/niveis ou via rebuild; a
tabela avisa que metas e nomes definitivos ainda estao pendentes.
"""
import asyncio
import sys

from app import conquistas as conquistas_service
from app import ranking as ranking_service
from app.redis_client import redis_client
from app.schemas import NivelCatalogo, Publico

# (id, nome, cidade, iniciais, litros)
ESTABELECIMENTOS = [
    ("e-01", "ToKonFome", "Itaquaquecetuba", "TK", 120.0),
    ("e-02", "Dogao do Adriano", "Osasco", "DA", 90.0),
    ("e-03", "Reuters", "Perus", "RT", 60.0),
    ("e-04", "Mineiro", "Guarulhos", "MI", 52.0),
    ("e-05", "Burger King", "Amparo", "BK", 50.0),
    ("e-06", "Padaria Sao Jorge", "Guarulhos", "PS", 41.0),
    ("e-07", "Cantina da Nonna", "Mooca", "CN", 33.0),
]

# Cidadaos nao tem cidade: addresses.owner_kind nao admite CITIZENS.
CIDADAOS = [
    ("c-01", "Maria Silva", "MS", 18.0),
    ("c-02", "Joao Pereira", "JP", 14.5),
    ("c-03", "Ana Souza", "AS", 11.0),
    ("c-04", "Carlos Lima", "CL", 7.5),
    ("c-05", "Beatriz Rocha", "BR", 4.0),
]

NIVEIS_DEMO = [
    NivelCatalogo(id="n-01", nome="Semente", descricao="Primeiros 50 litros.",
                  litros_requeridos=50),
    NivelCatalogo(id="n-02", nome="Broto", descricao="100 litros desviados do ralo.",
                  litros_requeridos=100),
    NivelCatalogo(id="n-03", nome="Arvore", descricao="250 litros acumulados.",
                  litros_requeridos=250),
    NivelCatalogo(id="n-04", nome="Floresta", descricao="500 litros acumulados.",
                  litros_requeridos=500),
]


async def limpar() -> None:
    """Apaga apenas as chaves deste projeto, nunca o banco inteiro."""
    padroes = (
        "ranking:*", "perfil:*", "conquistas:*", "conquista:*",
        "coletas:*", "niveis:*",
    )
    total = 0
    for padrao in padroes:
        async for chave in redis_client.scan_iter(match=padrao, count=200):
            await redis_client.delete(chave)
            total += 1
    print(f"Removidas {total} chaves.")


async def inserir(publico: Publico, linhas: list) -> None:
    catalogo = await conquistas_service.carregar_catalogo()
    for linha in linhas:
        if publico is Publico.ESTABELECIMENTO:
            entidade_id, nome, cidade, iniciais, litros = linha
        else:
            entidade_id, nome, iniciais, litros = linha
            cidade = None

        await ranking_service.salvar_perfil(
            publico, entidade_id, nome, iniciais, cidade
        )
        total = await ranking_service.registrar(publico, entidade_id, litros)
        await conquistas_service.incrementar_sucesso(publico, entidade_id)
        novas = await conquistas_service.avaliar(publico, entidade_id, total)

        nivel = conquistas_service.calcular_nivel(total, catalogo)
        marcas = ", ".join(c.titulo for c in novas) or "-"
        print(f"  {nome:22} {total:7.1f}L  lv.{nivel.nivel}  conquistas: {marcas}")


async def main() -> None:
    if not await redis_client.ping():
        print("Nao consegui falar com o Redis. Confira o .env.")
        sys.exit(1)

    if "--limpar" in sys.argv:
        await limpar()

    total = await conquistas_service.salvar_catalogo(NIVEIS_DEMO)
    print(f"\nCatalogo de niveis (DEMO): {total} niveis carregados.")

    print("\nEstabelecimentos (B2B):")
    await inserir(Publico.ESTABELECIMENTO, ESTABELECIMENTOS)

    print("\nCidadaos (B2C) - sem certificados, conforme a regra 11:")
    await inserir(Publico.CIDADAO, CIDADAOS)

    chaves = [c async for c in redis_client.scan_iter(match="*", count=500)]
    print(f"\nPronto. {len(chaves)} chaves no banco.")
    print("Teste: curl 'http://localhost:8081/api/ranking?periodo=mes&meuId=e-03'")

    await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())