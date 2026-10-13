# Olius — API de Ranking e Conquistas (Redis)

Serviço da disciplina de Banco de Dados 2. Responsável pelo ranking em tempo
real e pela gamificação do Olius. Não contém login, cadastro nem CRUD de
usuário — isso vive no backend principal.

## Modelagem no Redis

| Chave | Tipo | Uso |
|---|---|---|
| `ranking:{estab\|cidadao}:{AAAA-MM}` | ZSET | toggle "Este Mês", TTL de 2 anos |
| `ranking:{estab\|cidadao}:{AAAA}` | ZSET | toggle "Este Ano" |
| `ranking:{estab\|cidadao}:geral` | ZSET | toggle "Geral" |
| `perfil:{publico}:{id}` | HASH | nome, cidade, iniciais do avatar |
| `conquistas:{publico}:{id}` | ZSET | conquistas do usuário; score = timestamp |
| `conquista:{id}:portadores` | HLL | quantos usuários distintos possuem |
| `coletas:{publico}:{id}` | STRING | contador de coletas (INCR) |

São seis ZSETs de ranking: dois públicos × três períodos.

### Decisões que valem explicar na apresentação

- **ZSET em vez de `ORDER BY`**: `ZINCRBY` e `ZREVRANK` são O(log n). A posição
  individual do usuário (`Sua posição: #3 - 274.2L`) sai sem varrer a lista.
- **`ZREVRANK` conta do zero**, por isso somamos 1 antes de exibir.
- **ZSET para conquistas, não SET**: o score guarda *quando* a conquista foi
  desbloqueada, o que permite listar as mais recentes sem estrutura extra.
  O `ZADD` usa `nx=True` para nunca sobrescrever a data original.
- **HyperLogLog para raridade**: conta portadores distintos em ~12KB fixos,
  com erro de ~0,81%. Não serve para listar quem tem, só para contar.
- **O nível não é armazenado.** É função pura do total acumulado, que já está
  no ZSET geral. Guardar duplicaria estado e poderia divergir.
- **O Redis é volátil**: a verdade mora no Postgres do backend principal.
  O endpoint `POST /api/ranking/rebuild` existe para reconstruir os ZSETs.

## Endpoints

```
GET  /api/ranking?publico=estabelecimento&periodo=mes&limite=10&meuId=e-01
GET  /api/conquistas/{entidadeId}?publico=estabelecimento
POST /api/coletas
PUT  /api/perfis/{entidadeId}?publico=estabelecimento
POST /api/ranking/rebuild
GET  /health
```

Documentação interativa em `/docs` (Swagger gerado pelo FastAPI).

Em produção, `meuId` deve vir do token de autenticação, não da query string —
senão qualquer um consulta a posição alheia.

## Rodando local

```bash
docker compose up --build
# API em http://localhost:8081  •  Redis em localhost:6379
```

Sem Docker:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8081
```

## Publicando

1. **Redis** — Redis Cloud (tier gratuito de 30MB). Anote host, porta e senha.
2. **API** — Render ou Railway apontando para o `Dockerfile`. Cadastre
   `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` e `REDIS_SSL=true` no painel.

Nenhuma credencial é versionada: tudo passa por variáveis de ambiente, e o
`.env` está no `.gitignore`.

> No plano gratuito do Render o serviço hiberna após 15 minutos parado e a
> primeira requisição depois disso pode levar quase um minuto. Abra `/health`
> alguns minutos antes de apresentar.

## Teste rápido

```bash
curl -X PUT "http://localhost:8081/api/perfis/e-01?publico=estabelecimento" \
  -H "Content-Type: application/json" \
  -d '{"nome":"ToKonFome","cidade":"Itaquaquecetuba","iniciais":"TK"}'

curl -X POST http://localhost:8081/api/coletas \
  -H "Content-Type: application/json" \
  -d '{"publico":"estabelecimento","entidadeId":"e-01","litros":120}'

curl "http://localhost:8081/api/ranking?publico=estabelecimento&periodo=mes&meuId=e-01"
curl "http://localhost:8081/api/conquistas/e-01?publico=estabelecimento"
```
