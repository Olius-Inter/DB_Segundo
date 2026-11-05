# Airflow local — OLIUS legado

Orquestrador: Airflow 3.3.2 em Linux containers, com LocalExecutor. O PostgreSQL
16.15 deste Compose armazena apenas metadados do Airflow, não é banco legado nem
destino OLIUS. SQLite é somente staging da aplicação, não backend do Airflow.
`standalone` é adequado à demonstração local; esta configuração não é produção.

## DAG

`olius_legacy_preparation`: extract_legacy → prepare_citizens → summarize →
load_citizens → reconcile_destination → archive_history.
A exportação histórica é opcional e ocorre depois de a carga/reconciliação terminarem,
inclusive quando forem ignoradas ou falharem. Sua regra all_done não transforma
uma carga falha em sucesso da DAG. Sem snapshot preparado, o histórico é ignorado.

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

Da pasta `PostgreSQL/legacy_rpa_etl`, construa a imagem e execute os testes
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

## Histórico pela DAG (opt-in independente da carga)

O padrão OLIUS_ETL_ARCHIVE_ENABLED=false não grava nas pastas externas. Para usar,
verifique permissões de Pedro/Caio na pasta protegida, gere/guarde uma chave de
histórico separada e preencha os campos OLIUS_HISTORY_* do .env.example. Não use a
chave do staging, a chave do Airflow ou CPF_CHAVE como chave do histórico.

Os três diretórios devem existir: histórico protegido, backup local fora do
OneDrive e relatórios compartilhados. O complemento Compose não cria caminhos
faltantes automaticamente. Defina OLIUS_ETL_ARCHIVE_ENABLED=true e então:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.archive.yaml up -d --build
```

Para habilitar simultaneamente a carga autorizada, acrescente também
`-f compose.load.yaml`, com todas as salvaguardas de destino já configuradas.
Nada é disparado pelo comando acima: a DAG continua manual. Não foi alterado seu
.env nem reiniciado o ambiente em uso durante a implementação.

archive_history recebe apenas o ID do lote, abre uma transação de leitura no
staging, gera o histórico cifrado e valida a cópia local. Somente contagens e
metadados seguros vão ao log/XCom/pasta compartilhada. O arquivo completo nunca
é colocado na pasta do grupo. A sincronização OneDrive e recuperação da chave
pelo Caio continuam verificações externas, não confirmadas pela DAG.

Sem CPF_CHAVE, os CPFs AES-GCM ficam preservados como na origem e a preparação
informa CPF_DECRYPTION_KEY_REQUIRED. Esses cidadãos não são carregados; não gerar
CPF substituto nem liberar essas rejeições para satisfazer a carga.

## CI e cobertura

O CI executa os testes Python e integração com origem/destino fictícios em Docker,
mais os testes da DAG na imagem Airflow sem rede. Mede cobertura dos módulos em
coverage/legacy-etl-python.xml e da DAG em coverage/legacy-airflow/python.xml, ambos
consumidos pelo Sonar. O mínimo local configurado é 80% para cada conjunto. Testes
não são classificados como código principal no Sonar. Não se utilizam .env ou
credenciais reais nessas etapas.

Os testes da DAG verificam importação, grafo, funções de tarefa, falhas e flags com
dependências simuladas. A integração PostgreSQL verifica as operações reais de
carga. A execução ponta a ponta pelo scheduler/API em ambiente fictício está descrita em
SCHEDULER_VALIDATION.md. É uma validação adicional, distinta da cobertura medida
pelos testes de funções; não acessa o legado nem o destino reais.

A DAG possui uma tarefa final workflow_finished com regra none_failed. Ela depende
explicitamente da carga, reconciliação e histórico. Isso impede que o sucesso de
archive_history (all_done) esconda falhas anteriores no estado final da execução.
A etapa final não declara que houve importação quando a carga estava desabilitada.

As funções de tarefa usam batch_id para a identificação do lote. run_id é uma
chave reservada do contexto Airflow e não deve ser utilizada como parâmetro das
funções de tarefa com op_args. O scheduler real revelou esse conflito; a regressão
verifica os nomes e o teste ponta a ponta repete o caminho completo.
O LocalExecutor foi limitado a dois processos, mantendo uma tarefa/execução por
vez conforme a DAG, para reduzir consumo no ambiente local.

## Chave original do CPF (opcional)

Adicionar `-f compose.cpf.yaml` ao conjunto de arquivos Compose utilizado e definir
`OLIUS_LEGACY_CPF_KEY_HOST_FILE` com o caminho do arquivo privado de chave.
Não copiar o conteúdo para .env. A tarefa prepare_citizens lê o segredo pelo arquivo;
sem o complemento, CPFs cifrados continuam rejeitados por falta da chave.
Ver ../README.md para validações, proteção do staging e regras de reprocessamento.

## Cadastros B2B e motorista (opcional)

Adicionar `-f compose.extended.yaml` e configurar os caminhos privados
`OLIUS_B2B_COMPLEMENT_HOST_FILE` e `OLIUS_DRIVER_COMPLEMENT_HOST_FILE`.
O complemento habilita preparo dos CSVs no mesmo snapshot. Para escrever, são
necessários também compose.load.yaml, instalação única de
02_extended_destination_control.sql e ambas as flags de carga em true.
Sem `OLIUS_ETL_EXTENDED_LOAD_ENABLED=true`, a carga continua somente B2C.
Não houve alteração do .env pessoal nem execução contra o destino real.
Ver ../EXTENDED_LOAD.md para instalação, reexecução, primeira senha e limites.
