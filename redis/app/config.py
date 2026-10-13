"""Configuracao lida de variaveis de ambiente.

Nenhuma credencial fica no codigo. Em desenvolvimento, use o .env;
em producao (Render/Railway), cadastre as variaveis no painel.

O load_dotenv abaixo e o que faz o .env ser lido quando voce roda direto na
maquina (uvicorn, python -m scripts.seed). Dentro do Docker ele nao faz nada,
porque o compose ja injeta as variaveis no ambiente. Variavel de ambiente de
verdade sempre vence o que esta no .env, entao no Render o arquivo nem existe
e as credenciais do painel valem.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# procura o .env na raiz do projeto, uma pasta acima de app/
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    def __init__(self) -> None:
        self.redis_host: str = os.getenv("REDIS_HOST", "localhost")
        self.redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_password: str | None = os.getenv("REDIS_PASSWORD") or None
        self.redis_ssl: bool = os.getenv("REDIS_SSL", "false").lower() == "true"
        self.ttl_mensal: int = int(os.getenv("TTL_MENSAL", str(60 * 60 * 24 * 730)))
        self.max_conexoes: int = int(os.getenv("MAX_CONEXOES", "10"))


settings = Settings()