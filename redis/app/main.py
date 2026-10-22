"""Ponto de entrada da API de ranking e conquistas do Olius."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .redis_client import ping, redis_client
from .routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await redis_client.aclose()


app = FastAPI(
    title="Olius - Ranking e Conquistas",
    description="Servico de ranking em tempo real e gamificacao sobre Redis.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrinja ao dominio do app em producao
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "redis": await ping()}