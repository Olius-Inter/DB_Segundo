"""Popula o Redis com os dados de exemplo das telas do Figma.

Uso:
    python -m scripts.seed          # insere
    python -m scripts.seed --limpar # apaga tudo antes de inserir

Rode uma vez depois de configurar o .env, senao o app abre com o ranking
vazio. Os valores sao os mesmos que aparecem no prototipo.
"""
import asyncio
import sys

from app import conquistas as conquistas_service
from app import ranking as ranking_service
from app.redis_client import redis_client
from app.schemas import Publico

# (id, nome, cidade, iniciais, litros)
ESTABELECIMENTOS = [
    ("e-01", "ToKonFome", "Itaquaquecetuba", "TK", 120.0),
    ("e-02", "Dogao do Adriano", "Osasco", "DA", 90.0),
    ("e-03", "Reuters", "Perus", "RT", 60.0),
    ("e-04", "Mineiro", "Kemel Addans 1", "MI", 52.0),
    ("e-05", "Burger King", "Amparo", "BK", 50.0),
    ("e-06", "Padaria Sao Jorge", "Guarulhos", "PS", 41.0),
    ("e-07", "Cantina da Nonna", "Mooca", "CN", 33.0),
]

CIDADAOS = [
    ("c-01", "Maria Silva", "Itaquaquecetuba", "MS", 18.0),
    ("c-02", "Joao Pereira", "Osasco", "JP", 14.5),
    ("c-03", "Ana Souza", "Perus", "AS", 11.0),
    ("c-04", "Carlos Lima", "Guarulhos", "CL", 7.5),
    ("c-05", "Beatriz Rocha", "Mooca", "BR", 4.0),
]


async def limpar() -> None:
    """Apaga apenas as chaves deste projeto, nunca o banco inteiro."""
    padroes = ("ranking:*", "perfil:*", "conquistas:*", "conquista:*", "coletas:*")
    total = 0
    for padrao in padroes:
        async for chave in redis_client.scan_iter(match=padrao, count=200):
            await redis_client.delete(chave)
            total += 1
    print(f"Removidas {total} chaves.")


async def inserir(publico: Publico, linhas: list) -> None:
    for entidade_id, nome, cidade, iniciais, litros in linhas:
        await ranking_service.salvar_perfil(
            publico, entidade_id, nome, cidade, iniciais
        )
        total = await ranking_service.registrar(publico, entidade_id, litros)
        coletas = await conquistas_service.incrementar_coletas(publico, entidade_id)
        novas = await conquistas_service.avaliar(publico, entidade_id, total, coletas)
        nivel = conquistas_service.calcular_nivel(total)
        marcas = ", ".join(c.id for c in novas) or "-"
        print(f"  {nome:22} {total:7.1f}L  lv.{nivel.nivel}  conquistas: {marcas}")


async def main() -> None:
    if not await redis_client.ping():
        print("Nao consegui falar com o Redis. Confira o .env.")
        sys.exit(1)

    if "--limpar" in sys.argv:
        await limpar()

    print("\nEstabelecimentos (B2B):")
    await inserir(Publico.ESTABELECIMENTO, ESTABELECIMENTOS)

    print("\nCidadaos (B2C):")
    await inserir(Publico.CIDADAO, CIDADAOS)

    chaves = [c async for c in redis_client.scan_iter(match="*", count=500)]
    print(f"\nPronto. {len(chaves)} chaves no banco.")
    print("Teste: curl 'http://localhost:8081/api/ranking?periodo=mes&meuId=e-03'")

    await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())