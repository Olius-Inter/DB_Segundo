# Entrega — visita B2B sem atendimento (Sprint 9)

Entrada oficial: `record_failed_collection_visit(UUID, UUID, TEXT, TEXT) RETURNS UUID`.
Motivos: ESTABLISHMENT_CLOSED e NO_RESPONSIBLE_AVAILABLE. ADMIN ativo, chegada
registrada por motorista ativo, justificativa e ausência de aceite são obrigatórios.
Não há tabelas/colunas novas. Autor e horário de registro ficam na auditoria;
motorista e horário da chegada permanecem nos campos operacionais existentes.

O cálculo foi centralizado no núcleo privado record_collection_internal; a
assinatura pública record_collection permanece igual. Não há segundo cálculo.
Consome uma vaga e zero litros, aplica -50 nominais com saldo mínimo zero, sem
volume, aceite, bônus ou certificado fictícios. Correções mantêm revisão e não
podem transformar uma visita sem aceite em atendimento. Replay considera a
origem e a autoria originais inclusive após correções.

## Arquivos

- `PostgreSQL/04_functions_procedures.sql`
- `PostgreSQL/access_control/01_roles.sql`
- `PostgreSQL/access_control/API_DATABASE_CONTRACT.md`
- `PostgreSQL/access_control/README.md`
- `PostgreSQL/data_catalog/04_load.sql`
- `PostgreSQL/data_load/01_seed.sql`
- `PostgreSQL/data_load/README.md`
- `PostgreSQL/documents/model-data.js`
- `PostgreSQL/initial_data/01_reference_data.sql`
- `PostgreSQL/initial_data/02_validate.sql`
- `PostgreSQL/initial_data/README.md`
- `PostgreSQL/tests/README.md`
- `PostgreSQL/tests/api_access_regression.sql`
- `PostgreSQL/tests/initial_data_regression.py`
- `PostgreSQL/tests/procedures_concurrency.py`
- `PostgreSQL/tests/run_ci.py`
- `sonar-project.properties`
- `PostgreSQL/migrations/`
- `PostgreSQL/tests/failed_visit_migration_regression.py`
- `PostgreSQL/tests/failed_visit_regression.sql`
- `PostgreSQL/tests/fixtures_legacy_collection.sql`

A pasta migrations contém o SQL autossuficiente, instruções e este relatório.
Testes novos: failed_visit_regression.sql, failed_visit_migration_regression.py e
fixtures_legacy_collection.sql (contrato anterior restrito a teste). A concorrência
existente foi ampliada em cinco casos. Não houve alteração em 01_structure.sql,
02_check_constraints.sql, 03_indexes.sql, 05_triggers.sql, 06_ctes.sql,
07_window_functions.sql ou 08_materialized_views.sql: os mecanismos existentes
são suficientes. Os dados oficiais passaram de 16 para 18 configurações.

## Validação local e limites

- Instalação 01–08, catálogo e controle de acesso em base limpa.
- 14 regressões SQL, incluindo a nova visita, auditoria, pontos, segurança e rollback.
- Instalação 01–05 sem SUPERUSER nem SET em parâmetros personalizados.
- Migração aplicada duas vezes como instalador não-superusuário/proprietário do
  banco; fato anterior preservado, motivos sem duplicação, ACL/propriedade
  conferidos e visita executada após a migração.
- Carga oficial e 12 cenários concorrentes (7 anteriores + 5 novos).
- Runner de Data Load: 20 testes unitários, 19 passaram, 1 ignorado por limitação
  de symlink no Windows. Esses testes simulam comandos e não são uma carga real.
- git diff --check sem erros.

As execuções reais desta entrega utilizaram PostgreSQL 18 isolado na máquina,
pois o Docker não respondeu. PostgreSQL 16.15, a suíte completa com profiler,
a cobertura e o Quality Gate remoto ainda precisam ser conferidos no CI.
A carga de demonstração completa não foi executada neste ambiente alternativo:
o runner corretamente exige servidor 16.15. Nenhum banco instalado/Aiven foi
modificado e a migração de produção NÃO foi executada.

O Sonar mantém análises e cobertura. Somente a cópia SQL da migração foi
excluída da comparação de duplicação, por espelhar o código canônico; a regressão
exige igualdade entre ambas as definições para evitar divergência silenciosa.

## Aplicação no banco instalado

Após validar no CI 16.15 e conferir backup/destino, executar integralmente
`20261029_failed_collection_visit.sql`, fora de outra transação, com o instalador
previsto no cabeçalho. Em erro, ROLLBACK e investigar. Não rodar 01–03 e não
recriar o banco. As consultas após COMMIT devem mostrar os dois motivos ativos,
quatro rotinas com olius_business_owner, SECURITY DEFINER nas três entradas,
SECURITY INVOKER no núcleo e EXECUTE da API somente nas entradas públicas.
O contrato completo para a Core está em ../access_control/API_DATABASE_CONTRACT.md.
