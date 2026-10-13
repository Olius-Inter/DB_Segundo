# Olius — API de Ranking e Conquistas (Redis)

Serviço da disciplina de Banco de Dados 2. Responsável pelo ranking em tempo
real e pela gamificação do Olius. Não contém login, cadastro nem CRUD de
usuário — isso vive no backend principal. O app mobile fala só HTTP com esta
API; quem conversa com o Redis é o servidor.

```
App Kotlin  --HTTPS-->  esta API  --RESP-->  Redis Cloud
                            |
                            +--> Postgres (verdade dos dados, no repo principal)
```

---

## O que cada arquivo faz

### `app/config.py`
Lê as variáveis de ambiente e expõe o objeto `settings`. Nenhuma credencial
aparece no código: host, porta, senha, TLS, TTL das chaves mensais e o teto do
pool de conexões vêm todos do `.env` (local) ou do painel do Render
(produção). É o arquivo que atende ao requisito de ENVs.

### `app/redis_client.py`
Cria o cliente assíncrono único (`redis_client`) que todo o resto importa.
Também limita o pool a 10 conexões, porque o plano gratuito do Redis Cloud
corta em 30, e define timeout e health check. A função `ping()` alimenta o
endpoint `/health`.

### `app/schemas.py`
Contratos de entrada e saída, em Pydantic. Define os dois enums que espelham os
toggles da tela — `Publico` (Estabelecimento/Cidadão) e `Periodo`
(Mês/Ano/Geral) — e os modelos de resposta (`RankingResponse`,
`ConquistasResponse`, `NivelSustentabilidade`). Os campos usam alias em
camelCase para o Kotlin desserializar direto, sem anotação extra.

### `app/ranking.py`
Coração do requisito de ranking em tempo real. Monta as chaves dos seis ZSETs,
soma as coletas nos três períodos de uma vez via pipeline (`registrar`), e lê o
top N junto com a posição individual do usuário (`montar`). É aqui que mora o
`ZREVRANK`, que dá a posição em O(log n) sem varrer a lista, e a correção do
índice (o Redis conta do zero, a tela mostra #3). Também guarda o perfil em
HASH e gera as iniciais do avatar quando ninguém preencheu.

### `app/conquistas.py`
Gamificação. Guarda o catálogo estático de conquistas (`CATALOGO`), calcula o
nível de sustentabilidade a partir do total acumulado (`calcular_nivel`),
avalia o que foi desbloqueado após cada coleta (`avaliar`) e lista tudo com as
bloqueadas marcadas (`listar`). Usa ZSET com score de timestamp para saber
*quando* cada conquista caiu, e HyperLogLog para calcular raridade sem guardar
a lista de portadores.

### `app/routers.py`
As rotas HTTP. Traduz query string em enums, chama os serviços e devolve o
JSON. Nenhuma regra de negócio mora aqui. Inclui o stub do
`POST /api/ranking/rebuild`.

### `app/main.py`
Monta o FastAPI, liga o CORS, registra as rotas, expõe `/health` e fecha a
conexão com o Redis no shutdown.

### `app/__init__.py` e `scripts/__init__.py`
Arquivos **vazios**. Existem só para marcar as pastas como pacotes Python, o
que faz os imports relativos (`from .config import settings`) funcionarem.

### `scripts/seed.py`
Popula o banco com os dados do protótipo (ToKonFome, Dogão do Adriano,
Reuters...). Rode uma vez depois de configurar o `.env`, senão o app abre com
ranking vazio. Com `--limpar` apaga antes, usando `SCAN` por padrão de chave —
nunca `FLUSHALL`.

### `scripts/carga.py`
Teste de carga. Dispara N requisições com C em paralelo e mostra latência
média, p50, p95 e p99. Serve para medir os dois limites do plano gratuito:
100 ops/sec e 30 conexões.

### `tests/test_servicos.py`
Treze testes rodando contra um Redis falso em memória. Não tocam na nuvem, não
gastam cota e não sujam o banco. Cobrem a ordem do ranking, o `+1` da posição,
o nível exato do card do Figma, a idempotência das conquistas e o isolamento
entre públicos e períodos.

---

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