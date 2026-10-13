# Testes PostgreSQL e cobertura

O CI instala os scripts principais 01–07 em PostgreSQL 16.15 descartável e
executa regressões e disputas entre duas conexões. Qualquer erro interrompe a
execução antes da análise do Sonar. Nenhum teste deve ser executado no Aiven.

## Execução e dependências

`run_ci.py` exige `OLIUS_CI_DISPOSABLE=1` e um banco inicialmente vazio.
Usa as variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` e `PGDATABASE`.

| Entrega presente no checkout | Testes executados |
| --- | --- |
| Scripts principais | `procedures_regression.sql`, `functions_negative.sql`, `procedures_negative.sql` e `procedures_concurrency.py` |
| Views de pontuação e ranking | `annual_views_regression.sql`, após instalação de 06 e 07 |
| Sessões e tokens | `auth_sessions_regression.sql`, `auth_sessions_edges.sql`, `operational_regression.sql` e `auth_sessions_concurrency.py` |
| Catálogo | Instalação 01–04 e verificação `05_validate.sql` |
| Controle de acesso, catálogo e sessões | Também `catalog_access_regression.sql` e `api_access_regression.sql` |

Enquanto a branch de sessões não contém `access_control`, o runner utiliza
`ci_auth_bootstrap.sql`: uma fixture de permissões mínimas para exercitar as
funções de autenticação com `olius_api`. Ela não é uma entrega de controle de
acesso de produção. Quando os scripts oficiais estão presentes, o CI utiliza
exclusivamente esses scripts e testa as contas reais do projeto. Uma branch
com controle de acesso, mas sem catálogo ou sessões, falha por dependência.

## Views normais de pontuação e ranking

Os scripts 06 e 07 criam as views normais `public.vw_annual_scores` e
`public.vw_annual_ranking`, respectivamente. O 07 consulta a view do 06,
sem concatenar arquivos nem repetir CTEs. O contrato atual considera o ano
corrente em São Paulo. `annual_views_regression.sql` usa as procedures e
consulta as views para validar tipos, empates, piso zero, reenvios, correções,
anulações, recorrência, revisões e fronteira anual. Termina com `ROLLBACK`.
O Data Mart, Redis e Databricks não são dependências desses testes.

## Medição de cobertura

`functions_negative.sql` e `procedures_negative.sql` exercitam exceções das
rotinas do Script 04: registros inexistentes, parâmetros inválidos, autorização,
limite do ciclo e ausência de assinatura ativa. Usam `expect_error` para exigir
o SQLSTATE esperado; sucesso inesperado ou outro erro reprova o teste. Também
verificam ausência de efeitos indevidos em pontos, pedidos, entregas e benefícios.
Cada arquivo cria suas próprias fixtures dentro de uma transação e termina com
`ROLLBACK`. O runner os executa depois do reset do profiler, incluindo esses
caminhos na medição de cobertura sem alterar código de produção.

`Dockerfile.coverage` instala `plpgsql_check` somente na imagem de teste.
O servidor inicia com o profiler ativo e armazenamento compartilhado para
reunir contadores de todas as conexões, inclusive dos testes concorrentes.
Os contadores são zerados após a instalação e configuração das permissões.

`export_coverage.py` converte esses contadores em `coverage/postgresql.xml`,
no formato genérico aceito por `sonar.coverageReportPaths`. O corpo instalado
de cada rotina precisa corresponder ao checkout; divergências interrompem a
geração. Linhas sem execução, inclusive em rotinas nunca chamadas, recebem
`covered="false"`. Linhas com várias instruções só recebem `true` quando
todas foram exercitadas. Caminhos que lançam erros também são execução real.

O relatório mede as **linhas de início de instruções PL/pgSQL** nas functions,
procedures e funções de triggers dos scripts 04 e 05. Não mede criação de
tabelas, constraints, índices, comandos fora das rotinas, consultas em
linguagem SQL nem cobertura de ramificações. Essas partes são verificadas
funcionalmente pelos testes; não recebem cobertura artificial.

`test_export_coverage.py` verifica a conversão de linhas, contadores nulos,
instruções na mesma linha, caminhos de erro e divergências de código-fonte.

Os casos adicionais verificam rejeição de identidades/hashes inválidos,
expiração do token, atendimento idempotente, rejeição somente de pedidos
pendentes, preservação da justificativa e estados externos da cobrança.

O artefato `postgresql-tests-and-coverage` contém o XML, contadores originais
e logs. Esses arquivos são gerados durante o CI e não devem ser commitados.
O percentual informado pela ferramenta pode diferir do Sonar, que considera
suas próprias linhas executáveis e o código novo da PR. Gerar um relatório
não garante atingir o mínimo de 80%; isso depende dos cenários exercitados.
O scanner espera o Quality Gate: se o Sonar reprovar, a etapa também falha.

Referências: [profiler plpgsql_check](https://github.com/okbob/plpgsql_check#profiler)
e [formato genérico de cobertura do Sonar](https://docs.sonarsource.com/sonarqube-server/2025.6/analyzing-source-code/test-coverage/generic-test-data).
