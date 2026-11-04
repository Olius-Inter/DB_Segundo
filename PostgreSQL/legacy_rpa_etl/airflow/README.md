# Airflow local — OLIUS legado

Orquestrador: Airflow 3.3.2 em Linux containers, com LocalExecutor. O PostgreSQL
16.15 deste Compose armazena apenas metadados do Airflow, não é banco legado nem
destino OLIUS. SQLite é somente staging da aplicação, não backend do Airflow.
`standalone` é adequado à demonstração local; esta configuração não é produção.

## DAG

`olius_legacy_preparation`: extract_legacy → prepare_citizens → summarize →
load_citizens → reconcile_destination.

Execução manual, sem agenda, sem backfill e no máximo uma execução/tarefa por vez.
Só a extração possui uma retentativa automática, após 30 segundos. A UUID do lote
é derivada do ID da execução Airflow; retry/clear da mesma execução reutiliza um
snapshot já concluído e não reextrai. Para nova leitura da origem, dispare nova
execução. Enquanto houver tarefa ativa, não rode os comandos CLI contra o mesmo
staging. Não compartilhar esse SQLite entre servidores/workers distribuídos.

XCom transporta somente a UUID do lote. Dados pessoais ficam no staging persistente.
Falha técnica faz a tarefa falhar; as seguintes não executam. O erro aparece no
Airflow; os detalhes de qualidade permanecem nas tabelas SQLite. A preparação
pode concluir tecnicamente com candidatos BLOCKED_POLICY/REJECTED. Com carga desabilitada, load_citizens fica SKIPPED e a reconciliação não executa.
Com carga habilitada, o último passo reconcilia os cadastros. A conexão de destino
só é disponibilizada pelo complemento Compose opt-in.

## Configuração

Copie `.env.example` para `.env` e preencha os caminhos/dados da origem. Utilize
um pgpass dedicado contendo apenas a conta de leitura do legado; não monte um
arquivo com credenciais de outros bancos. A CA e esse arquivo são montados como
secrets somente leitura. O passfile é copiado para temporário com modo 0600 na
tarefa, sem retornar seu conteúdo em logs ou XCom.

Gere os segredos do ambiente local com Python (execute separadamente e transfira
os resultados para `.env`, não envie as saídas no chat ou Git):

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
python -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

Use HEX independentes para AIRFLOW_METADATA_PASSWORD e AIRFLOW_JWT_SECRET, e a
chave Base64 URL-safe para AIRFLOW_FERNET_KEY. Proteja o `.env` local.

Na pasta `PostgreSQL/legacy_rpa_etl/airflow`:

```powershell
docker compose up -d --build
docker compose exec airflow airflow dags list-import-errors
```

Abra http://localhost:8088. O usuário local é `pedro`; consulte a senha gerada em
`/opt/airflow/state/ui-passwords.json` dentro do container, sem compartilhar esse
arquivo. A autenticação simples é apenas do painel local, sem relação com logins
OLIUS. Despause a DAG e dispare manualmente somente quando desejar extrair dados.

```powershell
docker compose exec airflow cat /opt/airflow/state/ui-passwords.json
```

Volumes persistem metadados, staging, logs e senha do painel. `docker compose down`
para os serviços sem apagar dados; não use `down -v` se precisar preservar lotes.
As políticas de senha, ativação e datas foram aprovadas; ver README principal.
Antes de uso real ainda é necessário preparar e autorizar o destino, configurar a
chave exclusiva do staging e validar a execução completa pelo scheduler. Verificar aceitação de Airflow como RPA
com o professor: tecnicamente é um orquestrador de workflows.

## Validação sem acesso ao legado

Da pasta `PostgreSQL/legacy_rpa_etl`, construa a imagem e execute os três testes
da DAG (no PowerShell):

```powershell
docker build -t olius-legacy-airflow:validation -f airflow/Dockerfile .
$etlPath = (Get-Location).Path
docker run --rm --network none --entrypoint python -e AIRFLOW__CORE__LOAD_EXAMPLES=false -e PYTHONPATH=/opt/olius --mount "type=bind,source=$etlPath,target=/opt/olius,readonly" --mount "type=bind,source=$etlPath/airflow/dags,target=/opt/airflow/dags,readonly" olius-legacy-airflow:validation /opt/olius/airflow/tests/test_dag_contract.py
```

Esses testes não iniciam o painel/scheduler nem executam extração real. O teste
de importação usa a API do Airflow 3.3.2; não exige instalar Airflow no Windows.

## Atualização para transporte protegido e carga

Não disparar a DAG antiga enquanto configura esta atualização. Não reaproveitar
lotes anteriores sem credenciais seladas. Faça nova execução após recriar o container.

Crie um arquivo exclusivo para a chave Fernet do ETL fora do Git/OneDrive/staging.
No PowerShell, exemplo (não sobrescrever uma chave já existente):

```powershell
python -c "from pathlib import Path; from cryptography.fernet import Fernet; p=Path.home()/'olius-secrets'/'etl-credentials.key'; p.parent.mkdir(exist_ok=True); f=p.open('xb'); f.write(Fernet.generate_key()); f.close()"
```

O comando não exibe a chave. Configure OLIUS_CREDENTIAL_KEY_FILE no .env com o
caminho absoluto desse arquivo. Restrinja o acesso à pasta no Windows. Não reutilize
AIRFLOW_FERNET_KEY. Complete os novos campos usando .env.example como referência,
sem substituir seu .env inteiro. Reconstruir a imagem instala a dependência
cryptography e monta os novos módulos/chave; o container atual não foi reiniciado
automaticamente por esta alteração.

Para somente extrair/preparar, mantenha OLIUS_ETL_LOAD_ENABLED=false:

```powershell
docker compose --env-file .env up -d --build
```

Para carga autorizada, primeiro instale ../01_destination_control.sql no banco de
destino e configure a conta de manutenção, CA e pgpass exclusivo desse destino no
.env. A conta não é olius_core_api. Configure OLIUS_ETL_CONFIRMED_TARGET exatamente
como host:porta/banco e OLIUS_ETL_LOAD_ENABLED=true. Então use ambos os arquivos:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.load.yaml up -d --build
```

Esses comandos só iniciam o ambiente; não disparam a DAG nem instalam SQL no alvo.
Não execute o complemento de carga até confirmar o banco e a autorização de uso.
Uma falha no meio da carga pode deixar cidadãos anteriores já confirmados; retomada
é feita pela mesma execução/lote, que consulta o controle transacional no destino.
Configuração atual cobre migração administrada local, não serviço de produção.
