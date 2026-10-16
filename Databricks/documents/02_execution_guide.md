# Exportação do Aiven e ingestão na Free Edition

## Fluxo adotado

O exportador 06_export_snapshot.py roda em um computador ou runner com rede
para o Aiven. Usa duas contas PostgreSQL: uma para pedir refresh e outra para
ler as views. Produz uma pasta com UUID, Parquets e manifest.json.

Os arquivos são enviados a um Volume. O Job no Databricks executa
02_ingestion.py para validar e publicar o snapshot, sem conectar ao Aiven.

Referências:
- [Limitações da Free Edition](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations).
- [Arquivos em Volumes](https://docs.databricks.com/aws/en/volumes/volume-files).
- [CLI para copiar arquivos](https://docs.databricks.com/aws/en/dev-tools/cli/reference/fs-commands).
- [Tarefas Python](https://docs.databricks.com/aws/en/jobs/tasks/python-script).

## 1. Preparar o PostgreSQL

Instalar os scripts principais 01–07, depois 08_materialized_views.sql.
Instalar o catálogo e executar access_control/01_roles.sql e 02_users.sql.

A configuração de permissões fica exclusivamente nos scripts de access_control.
Não aplicar GRANT SELECT ON ALL TABLES a ambas as contas nem conceder acesso
direto às fontes public para os logins BI.

| Conta | Permissão prevista |
| --- | --- |
| olius_bi_reader | SELECT nos 13 conjuntos materializados e dm.refresh_state |
| olius_bi_refresh | EXECUTE em dm.refresh_data_mart() e SELECT em dm.refresh_state |

As contas são criadas sem senha. Configurar credenciais no ambiente, fora do
Git. O proprietário interno é olius_dm_owner. O requisito de SET ROLE para a
implantação permanece como está no código, aguardando definição com os
responsáveis; este guia não concede nem modifica essa autorização.

Se um ambiente antigo já tiver o schema dm dos rascunhos, não reaplicar CREATE
como se fosse uma base vazia: avaliar uma migração antes. A instalação das
views materializadas é única.

## 2. Preparar a máquina de exportação

Instalar Python compatível com psycopg e PyArrow e estas dependências:

```text
python -m pip install "psycopg[binary]" pyarrow
```

Disponibilizar 06_export_snapshot.py, 02_ingestion.py e 05_data_contract.json
no mesmo diretório, preservando os nomes. O importador é usado como módulo
de funções/contrato pelo exportador; não executa Spark nessa importação.

Configurar no processo externo, por um gestor de segredos ou ambiente local:

| Variável | Valor |
| --- | --- |
| OLIUS_BI_READ_USER | olius_bi_reader |
| OLIUS_BI_READ_PASSWORD | Senha da conta de leitura |
| OLIUS_BI_REFRESH_USER | olius_bi_refresh |
| OLIUS_BI_REFRESH_PASSWORD | Senha da conta de refresh |

Não registrar senhas no repositório, manifesto ou parâmetros da linha de comando.

No Aiven, obter host, porta real, banco e CA Certificate (ca.pem). O exportador
usa verify-full e exige --sslrootcert. Liberar na rede o computador/runner
externo, não os executores do Databricks. Usar endpoint direto, sem pool
transacional, pois o controlador mantém advisory lock de sessão.

## 3. Preparar o Databricks

Importar o repositório no Workspace/Git. No SQL editor, definir o parâmetro
catalog com um catálogo existente e executar:

1. 01_structure.sql: schemas, tabelas Delta, controle e Volume snapshots.
2. 03_views.sql: star schema de consumo e views dos dashboards.

As views estarão vazias antes do primeiro lote. Usar o mesmo catálogo em todos
os arquivos. O código aceita nomes de catálogo com letras, números e underscore.

A identidade de instalação precisa criar schemas/tabelas/Volume/views.
O upload precisa USE CATALOG, USE SCHEMA e WRITE VOLUME no Volume snapshots.
O Job precisa READ VOLUME, uso do catálogo/schema e leitura/MODIFY nas tabelas
landing. Consumidores dos dashboards recebem acesso às views necessárias em
olius_bi, sem credenciais do PostgreSQL.

## 4. Exportar o snapshot

Exemplo na máquina externa; substituir host, porta e banco:

```text
python Databricks/06_export_snapshot.py --pg-host HOST_AIVEN --pg-port PORTA_AIVEN --pg-database BANCO --sslrootcert "C:/certificados/ca.pem" --output-root "C:/OliusExports"
```

O exportador imprime a pasta criada: C:/OliusExports/EXPORT_ID, onde EXPORT_ID
é um UUID real. Mantê-la fora do repositório, pois contém dados exportados.

O refresh ocorre antes da leitura. Cada conjunto contém um ou mais Parquets,
inclusive um arquivo com schema quando não há linhas. O manifesto final
registra snapshot, horário, arquivos, hashes, contagens e somas de medidas.
Pasta sem manifest.json indica exportação incompleta e não deve ser publicada.

## 5. Enviar os arquivos ao Volume

Autenticar a CLI Databricks no workspace por um perfil aprovado ou usar a
interface de upload de Volumes. O destino deve preservar esta estrutura:

```text
/Volumes/CATALOGO/olius_bi_landing/snapshots/EXPORT_ID/
    dim_tempo/part-00000.parquet
    ... demais conjuntos, nos diretórios originais ...
    manifest.json
```

Exemplo PowerShell, com a CLI autenticada e placeholders substituídos:

```powershell
$exportRoot = 'C:/OliusExports/EXPORT_ID'
$volumeRoot = 'dbfs:/Volumes/CATALOGO/olius_bi_landing/snapshots/EXPORT_ID'
databricks fs mkdir $volumeRoot
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o diretório de upload' }
foreach ($dataset in Get-ChildItem -LiteralPath $exportRoot -Directory) {
    databricks fs cp $dataset.FullName "$volumeRoot/$($dataset.Name)" --recursive
    if ($LASTEXITCODE -ne 0) { throw 'Upload interrompido; manifesto não enviado' }
}
databricks fs cp "$exportRoot/manifest.json" "$volumeRoot/manifest.json"
if ($LASTEXITCODE -ne 0) { throw 'Falha no envio do manifesto' }
```

Enviar o manifesto por último e não modificar uma pasta publicada. O Job
verifica hashes/tamanhos e não carrega um conjunto com upload incompleto.

## 6. Executar o Job

Criar uma tarefa Python script serverless para Databricks/02_ingestion.py.
O arquivo 05_data_contract.json deve estar ao lado do Python no Workspace/Git.
Configurar a lista de argumentos:

```text
--catalog CATALOGO
--snapshot-path /Volumes/CATALOGO/olius_bi_landing/snapshots/EXPORT_ID
```

Não usar os argumentos antigos --pg-host, --secret-scope ou certificados nesse
Job: eles não pertencem ao importador atual. Psycopg, PyArrow e credenciais de
Aiven ficam na máquina externa; o Job usa Spark e bibliotecas padrão Python.

Configurar no máximo uma ingestão simultânea para o mesmo Data Mart, inclusive
entre Jobs diferentes. Executar Run now, verificar o lote publicado e rodar
04_quality_checks.sql. Atualizar os datasets dos dashboards depois do sucesso.

## 7. Agendamento e operação

A atualização completa exige exportar → enviar → executar a ingestão do
EXPORT_ID novo → atualizar dashboards. Um Job agendado com caminho fixo
reprocessa o mesmo snapshot e não busca dados novos no Aiven.

Nesta versão, exportação, upload e disparo do Job não têm orquestração automática
pronta. Definir o runner/agendador externo e suas credenciais antes de prometer
atualização periódica. Falhas mantêm o último lote validado; acompanhar o
horário de vw_atualizacao_dashboard e configurar alertas.

## Diagnóstico

| Sintoma | Conferir |
| --- | --- |
| Exportador não conecta | Host/porta, allowlist do Aiven, senha e ca.pem na máquina externa |
| Refresh negado | Papéis instalados, EXECUTE e pendência de provisionamento SET ROLE |
| Arquivo/manifesto ausente | Estrutura de diretórios e conclusão do upload |
| Hash divergente | Arquivo incompleto ou modificado; gerar/enviar snapshot íntegro |
| Contrato/schema divergente | JSON, SQL de destino e scripts Python da mesma versão |
| Dashboard vazio | Existência de lote publicado e dados elegíveis na origem |
| Snapshot antigo recusado | Caminho do lote mais recente; não sobrescrever a pasta antiga |
