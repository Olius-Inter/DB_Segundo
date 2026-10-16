# Olius — Data Mart na Databricks Free Edition

O Data Mart contém três fatos, oito dimensões, uma ponte de motivos e uma
fotografia do ranking anual aprovado. São 13 views materializadas no PostgreSQL,
mais a tabela técnica dm.refresh_state.

A Free Edition usa compute serverless e restringe acesso externo. O fluxo
implementado exporta o Aiven **fora do Databricks**, envia arquivos Parquet
para um Volume e executa a ingestão no Databricks. Não exige JDBC, cluster
dedicado nem credenciais PostgreSQL dentro do workspace.

## Arquivos e sequência

| Ordem | Arquivo / atividade | Onde executar |
| --- | --- | --- |
| 1 | Scripts principais 01–07 e 08_materialized_views.sql | PostgreSQL |
| 2 | Catálogo de dados, access_control/01_roles.sql e 02_users.sql | PostgreSQL |
| 3 | 01_structure.sql, seguido de 03_views.sql | Databricks SQL |
| 4 | 06_export_snapshot.py, usando 02_ingestion.py e 05_data_contract.json ao lado | Computador/runner externo |
| 5 | Upload dos Parquets e, por último, manifest.json | CLI ou interface de Volumes |
| 6 | 02_ingestion.py com --catalog e --snapshot-path | Databricks, tarefa Python serverless |
| 7 | 04_quality_checks.sql | Databricks SQL |

Os arquivos PostgreSQL são executados no banco da aplicação; os SQLs deste
diretório, no Databricks. A numeração identifica os arquivos, não substitui
a sequência acima. O contrato JSON deve acompanhar os dois scripts Python.

09_refresh_materialized_views.sql é uma opção de refresh manual no PostgreSQL.
O exportador já chama o mesmo procedimento antes de ler; não é necessário
agendar um segundo refresh para a mesma exportação.

## Guias

- [Modelo e indicadores](01_data_mart_model.md).
- [Conexão, exportação, upload e execução](02_execution_guide.md).
- [Publicação, falhas e validação](03_refresh_and_validation.md).

## Camadas

```text
Aiven/PostgreSQL: public
       ↓ refresh transacional
Aiven/PostgreSQL: dm
       ↓ exportador externo: psycopg + PyArrow
Parquets e manifest.json de um snapshot completo
       ↓ upload para /Volumes/<catalog>/olius_bi_landing/snapshots/<export_id>
Databricks: tabelas Delta em olius_bi_landing
       ↓ validação + publicação do lote
Databricks: views em olius_bi → dashboards
```

As views comuns em olius_bi consultam o lote publicado, sem REFRESH próprio.
A atualização dos resultados/cache dos dashboards ocorre depois da ingestão.

Nenhum destes arquivos cria automaticamente conexão, agendamento externo ou
Job. A integração deve ser homologada no Aiven e no workspace. A decisão sobre
o provisionamento SET ROLE/propriedade segue pendente com os responsáveis;
esta documentação não altera a política atual dos scripts de acesso.
