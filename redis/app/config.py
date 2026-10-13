"""Configuracao lida de variaveis de ambiente.

Nenhuma credencial fica no codigo. Em desenvolvimento, use o .env;
em producao (Render/Railway), cadastre as variaveis no painel.
"""
import os


class Settings:
    def __init__(self) -> None:
        self.redis_host: str = os.getenv("REDIS_HOST", "localhost")
        self.redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_password: str | None = os.getenv("REDIS_PASSWORD") or None
        self.redis_ssl: bool = os.getenv("REDIS_SSL", "false").lower() == "true"
        # TTL das chaves mensais: 2 anos em segundos.
        self.ttl_mensal: int = int(os.getenv("TTL_MENSAL", str(60 * 60 * 24 * 730)))


settings = Settings()