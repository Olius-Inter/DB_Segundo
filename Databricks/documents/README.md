# Olius — Data Mart e dashboards no Databricks

Este diretório contém código destinado ao **Databricks**. O diretório
`PostgreSQL` contém os scripts destinados ao banco da aplicação. Arquivos
versionados não criam conexões, Jobs ou dashboards automaticamente.

O Data Mart usa star schema: três fatos, oito dimensões e uma ponte de motivos.
Ranking/window function pertence a outra tarefa e não é implementado aqui.

## Arquivos e sequência

| Ordem | Arquivo | Onde executar | Frequência |
| --- | --- | --- | --- |
| 1 | `PostgreSQL/07_materialized_views.sql` | PostgreSQL | Instalação única |
| 2 | Configurar papéis, rede e secrets | Provedor PostgreSQL e Databricks | Preparação |
| 3 | `Databricks/01_structure.sql` | Databricks SQL | Instalação |
| 4 | `Databricks/03_views.sql` | Databricks SQL | Instalação ou alteração das views |
| 5 | `Databricks/02_ingestion.py` | Databricks, tarefa Python script | A cada execução do Job |
| 6 | `Databricks/04_quality_checks.sql` | Databricks SQL | Homologação/diagnóstico |

As views podem ser instaladas antes da primeira carga; estarão vazias até
a publicação. Os números identificam a responsabilidade de cada arquivo:
estrutura, ingestão, views e verificações. O SQL de estrutura é idempotente,
mas não aplica migrações se uma tabela existente tiver colunas diferentes.

O script `PostgreSQL/08_refresh_materialized_views.sql` permite refresh manual.
O Python já executa o mesmo procedimento; não é preciso uma segunda tarefa
de refresh antes dele. Todos os refreshes devem usar esse procedimento.

## Guias

- [Modelo e indicadores](01_data_mart_model.md): fontes, granularidade e métricas.
- [Conexão e execução](02_execution_guide.md): requisitos, parâmetros e Job.
- [Atualização e validação](03_refresh_and_validation.md): publicação por lote,
  falhas, limites e testes.

## Camadas

```text
PostgreSQL: public — banco operacional da aplicação
              ↓ refresh transacional
PostgreSQL: dm — views materializadas e estado do snapshot
              ↓ Python/JDBC: leitura integral
Databricks: <catalog>.olius_bi_landing — tabelas Delta por lote
              ↓ validações + publicação de um único ponteiro
Databricks: <catalog>.olius_bi — star schema e views de dashboards
```

Os dashboards consultam `olius_bi`, sem acesso direto às tabelas landing.
Não criar refresh próprio para essas views comuns no Databricks: elas
consultam o lote ativo. O refresh de resultados/cache do dashboard é separado.

## Estado da entrega

São scripts de implementação e guias de configuração. Nenhuma conexão de nuvem
ou Job foi criado por estes arquivos. Os provedores, catálogo, secret scope,
permissões e disponibilidade de compute precisam ser definidos no ambiente.
