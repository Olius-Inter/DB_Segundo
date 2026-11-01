# Recuperação de senha — entrega e validação

Data: 01/11/2026. Branch local: `feat/password-reset`. Referência anterior: `70aa130cd2fc3c6154641bee1942395458cbdfcb`.

## Diagnóstico da referência

Sessões já usavam locks users → sessão → refresh, resultados controlados e contexto de auditoria salvo/restaurado sem SET de parâmetros customizados na definição. O login tinha dois parâmetros e confiava integralmente na autenticação anterior da Core, permitindo a corrida com uma troca de senha posterior. Convites administrativos já têm armazenamento e mutex próprios; não foram reutilizados ou modificados. A recuperação só altera password_hash, sem tomar o mutex administrativo após users, e preserva a proteção do último ADMIN.

O contrato atual de e-mail mantém caixa da parte local e normalização apenas do domínio. Os cadastros e UNIQUE(email) existentes não foram modificados; ambiguidade legada é rejeitada sem escolher conta arbitrariamente.

## Implementação

- `password_reset_token`: sete colunas (identidade, usuário, hash, emissão, expiração, consumo e invalidação), FK RESTRICT, UNIQUE do hash, CHECKs temporais/terminalidade e trigger de imutabilidade.
- `password_reset_token_log`: 16 colunas de metadados e snapshots; não possui hashes de token ou senha. Eventos públicos SYSTEM, sem ADMIN fictício.
- Três índices não redundantes: janela por usuário/emissão, histórico do token e lookup por parte local exata/domínio normalizado.
- `issue_password_reset(text,bytea,interval)`: uma linha com result_code/reset_id/user_id/expires_at; OK, INVALID_INPUT, USER_UNAVAILABLE, RATE_LIMITED ou HASH_CONFLICT. Padrão 30 minutos; três emissões em 15 minutos e intervalo mínimo de 60 segundos.
- `complete_password_reset(bytea,text)`: TEXT OK, INVALID_INPUT ou INVALID_TOKEN. Senha, consumo, invalidação dos outros links e revogação de sessões PASSWORD_RESET são atômicos. Não autentica automaticamente.
- `open_auth_session(uuid,bytea,text)`: compara sob lock o hash exato validado pela Core; acrescenta CREDENTIAL_CHANGED. A assinatura antiga não pode ficar disponível.
- Permissões: funções com olius_auth_owner NOLOGIN e search_path fixo. Apenas Core recebe as novas operações; sem DML/leitura direta de tokens ou logs. O owner tem UPDATE apenas de consumed_at/invalidated_at na tabela nova e password_hash em users. Auditor só lê os metadados do log.

Contrato completo, ajustes necessários na Core e sequência de publicação: [PASSWORD_RESET.md](PASSWORD_RESET.md).

## Testes executados

A execução integral de `python PostgreSQL/tests/run_ci.py` terminou com código zero no PostgreSQL 16.15 descartável, com profiler real. Passaram instalação 01–05 sem SUPERUSER/sem SET em parâmetros app.*, instalação completa 01–08, catálogo, roles/users, cargas oficiais, migrações anteriores, nova migração, funções/procedures, sessões, contexto, coletas, API, Data Mart, administração, histórico e todas as disputas concorrentes.

A migração foi aplicada como um único lote SQL sobre uma instalação da referência anterior, por um instalador NOSUPERUSER autorizado. Foram comparados antes/depois os registros completos de usuários, hashes de senha, sessões, refresh tokens, convites e logs. A Core real executou emissão/conclusão após a migração. As definições das três funções novas/alteradas coincidiram com a instalação nova. Banco e papel do teste foram removidos.

As nove novas disputas confirmaram: uso único do mesmo token; tokens distintos da mesma conta; reset antes/depois do login; reset antes/depois do refresh; reset antes/depois da inativação; emissões simultâneas. A espera real no bloqueio foi observada, sem depender apenas de sleeps. Regressores anteriores de convites e último ADMIN também passaram.

| Rotina | Instruções cobertas/medidas | Cobertura |
|---|---:|---:|
| open_auth_session | 21/21 | 100% |
| issue_password_reset | 26/27 | 96,30% |
| complete_password_reset | 21/21 | 100% |
| fn_olius_password_reset_guard | 5/5 | 100% |

Cobertura exportada em `coverage/postgresql.xml`, com perfis em `coverage/plpgsql-profile.json`. A ausência de cobertura de um ramo defensivo não foi ocultada ou substituída por cobertura artificial.

Também passaram: 4 testes do exportador; 20 testes do runner de Data Load (um skip previsto pelo ambiente); 10 testes Databricks; seis testes de segurança do backup no Linux; execução real da carga de demonstração com instalação/permissões em outro container; recuperação completa de backup em PostgreSQL 16.15 com duas instâncias e administrador NOSUPERUSER.

Resultado da recuperação: PASS: 77 tabelas/views materializadas; SHA256 de todos os registros e DDL/owners/ACLs iguais. Login da Core, INSERT auditado, SECURITY DEFINER e negação de DDL passaram; cobertura Python do runner de recuperação continuou 160/176 (90,91%). Artefatos ficam em coverage/, ignorados pelo Git.

## Implantação e limites

Migração: `migrations/20261101_password_reset.sql`, de aplicação única, inteira e fora de transação externa. Dois blocos explícitos: o ENUM confirma primeiro; o restante é transacional. Não usar --single-transaction externo. Se o bloco principal falhar, ROLLBACK; o rótulo aditivo pode permanecer sem alterar usuários/sessões. Não apagar tabelas para repetir uma migração já concluída.

A Core deve entrar em manutenção durante a troca da assinatura: preparar aplicação → backup → migrar banco → publicar versão Java com terceiro argumento e recuperação → verificar → liberar. O terceiro argumento deve ser o hash que a Core efetivamente validou, não uma releitura posterior. SMTP somente após commit e resposta HTTP genérica. Não foi implementado Java, envio de e-mail, limite por IP, retenção ou histórico de senhas.

Nenhum banco DEV/Aiven/produção foi alterado. As evidências são locais em PostgreSQL 16.15; não equivalem à aprovação remota do Sonar ou à validação de rede/TLS/SMTP na Aiven. Outras versões principais não foram validadas nesta entrega.

## Arquivos alterados/adicionados

| Arquivo | Justificativa |
|---|---|
| `PostgreSQL/01_structure.sql` | Acrescenta PASSWORD_RESET ao ENUM; cria tokens próprios e auditoria sem hash. |
| `PostgreSQL/02_check_constraints.sql` | Valida hash de 32 bytes, cronologia finita e estados terminais exclusivos. |
| `PostgreSQL/03_indexes.sql` | Indexa janela por usuário/emissão, histórico e lookup de e-mail sem alterar unicidade. |
| `PostgreSQL/04_functions_procedures.sql` | Emissão/conclusão transacionais e terceiro argumento obrigatório no login. |
| `PostgreSQL/05_triggers.sql` | Protege identidade/terminalidade e audita metadados sem segredos. |
| `PostgreSQL/AUTH_SESSIONS.md` | Sincroniza documentação do contrato, privilégios, testes e implantação. |
| `PostgreSQL/PASSWORD_RESET.md` | Sincroniza documentação do contrato, privilégios, testes e implantação. |
| `PostgreSQL/access_control/01_roles.sql` | Owner interno e grants estreitos; rejeita assinatura/overload de login incompatível. |
| `PostgreSQL/access_control/02_users.sql` | Atualiza somente a verificação de pré-requisito da assinatura; não cria novas contas. |
| `PostgreSQL/access_control/API_DATABASE_CONTRACT.md` | Sincroniza documentação do contrato, privilégios, testes e implantação. |
| `PostgreSQL/access_control/README.md` | Sincroniza documentação do contrato, privilégios, testes e implantação. |
| `PostgreSQL/backup_recovery/validate_recovery.py` | Atualiza somente a chamada de login do smoke test para o terceiro argumento. |
| `PostgreSQL/data_catalog/04_load.sql` | Documenta novas tabelas/23 colunas e atualiza motivo de revogação, sem valores reais. |
| `PostgreSQL/data_catalog/05_validate.sql` | Atualiza apenas o comentário com os totais novos. |
| `PostgreSQL/data_catalog/README.md` | Sincroniza documentação do contrato, privilégios, testes e implantação. |
| `PostgreSQL/migrations/20261101_password_reset.sql` | Atualização autossuficiente com preservação de dados e retirada da assinatura antiga. |
| `PostgreSQL/tests/README.md` | Sincroniza documentação do contrato, privilégios, testes e implantação. |
| `PostgreSQL/tests/admin_management_regression.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/api_access_regression.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/auth_audit_context_regression.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/auth_non_superuser_install.py` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/auth_sessions_concurrency.py` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/auth_sessions_edges.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/auth_sessions_regression.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/catalog_access_regression.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/ci_auth_bootstrap.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/password_reset_concurrency.py` | Testa nove disputas em conexões reais e observa espera de bloqueio. |
| `PostgreSQL/tests/password_reset_migration_regression.py` | Instala a referência anterior e migra como NOSUPERUSER, em lote único de editor SQL. |
| `PostgreSQL/tests/password_reset_regression.sql` | Testa emissão, conclusão, permissões, auditoria, erros e rollback integral. |
| `PostgreSQL/tests/ranking_access_regression.sql` | Adapta fixture/chamada para terceiro argumento do login ou novos totais do catálogo. |
| `PostgreSQL/tests/run_ci.py` | Integra regressão funcional, migração e concorrência à execução de CI existente. |
| `sonar-project.properties` | Exclui apenas duplicação do espelho da migração; análise de código e cobertura permanecem. |

| `PostgreSQL/PASSWORD_RESET_VALIDATION.md` | Diagnóstico, lista de arquivos e evidências reais desta entrega. |

## Arquivos analisados sem mudança funcional necessária

- Principais 06_ctes.sql, 07_window_functions.sql e 08_materialized_views.sql: tratam pontuação/ranking/BI e não consomem credenciais ou tokens de recuperação.
- data_catalog/01_structure.sql, 02_check_constraints.sql e 03_view.sql: a estrutura documental e a introspecção já suportam as novas tabelas; o 04_load contém seus metadados. O 05_validate recebeu apenas correção do comentário de totais.
- admin_management/README.md e rotinas de convite/status: recuperação não cria ADMIN, altera perfil/status ou substitui convites. Seus contratos e regressões foram preservados.
- initial_data e scripts SQL do Data Load: recuperação não é configuração inicial nem dado fictício obrigatório; não foram gerados tokens reais. A carga de demonstração passou sem alterar seus scripts.
- .github/workflows/ci.yml: já chama run_ci.py; a integração foi feita nesse runner, sem duplicar jobs ou modificar a serialização do Sonar.
- Nenhuma tabela de negócio, regra financeira, cálculo de pontos ou contrato Redis precisou mudar.

Nenhum commit ou push foi realizado pelo assistente.
