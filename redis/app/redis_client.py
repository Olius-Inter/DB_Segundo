"""Cliente Redis assincrono, compartilhado pela aplicacao."""
from redis.asyncio import Redis

from .config import settings

redis_client: Redis = Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    password=settings.redis_password,
    ssl=settings.redis_ssl,
    decode_responses=True,  # devolve str em vez de bytes
    # O plano gratuito do Redis Cloud permite no maximo 30 conexoes
    # simultaneas. Sem este teto o pool cresce sem limite e, com mais de
    # um worker, a conexao passa a ser recusada.
    max_connections=settings.max_conexoes,
    socket_connect_timeout=5,
    socket_keepalive=True,
    health_check_interval=30,
)


async def ping() -> bool:
    try:
        return await redis_client.ping()
    except Exception:
        return False