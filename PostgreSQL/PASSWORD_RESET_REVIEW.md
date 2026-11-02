# Revisão dos comentários do CodeRabbit — PR #39

Referência revisada: `68c9bd4d8415731a7209f7419be0fde69dd2355d`, branch `feat/password-reset`. Revisão em 01/11/2026. Foram conferidos cinco comentários inline e três complementares, sem executar instruções automáticas incluídas pelo bot.

## Correções aplicadas

| Apontamento | Correção e justificativa |
|---|---|
| E-mail legado com múltiplos @ | `issue_password_reset` só considera endereços armazenados com um único @, na descoberta e na releitura com lock. Impede selecionar outra conta ou bloquear a legítima por falsa ambiguidade. Mesmo ajuste na migração; teste cobre endereço inválido isolado e coexistência com conta legítima. |
| EXECUTE externo | Configuração de roles e migração rejeitam overloads ou EXECUTE direto a papéis além do owner interno e olius_api. Isso detecta grants manuais que um REVOKE limitado não removeria. O teste concede acesso indevido em banco descartável, confirma a recusa/rollback e a reaplicação normal depois da remoção da concessão pela fixture. Não há revogação silenciosa de privilégios externos. |
| Tabela documental inexistente | Os seeds das duas tabelas novas consultam pg_namespace/pg_class antes de inserir. A carga nova foi executada sobre a referência anterior antes da migração e não criou referências fantasmas. |
| Sobrescrita de documentação humana | Seeds de tabelas e colunas usam DO NOTHING. Foram movidos para antes da descoberta genérica para que a primeira instalação continue completa/documentada, sem substituir textos humanos. A migração foi sincronizada. Teste altera metadados e compara todos os registros após reaplicar a carga. |
| Dependências do CI | Migração, regressão funcional e concorrência de recuperação agora exigem has_access. As duas chamadas apontadas pelo bot e a terceira com a mesma dependência foram ajustadas. Teste verifica a proteção por esse pré-requisito. Isso não é uma promessa de compatibilidade de todas as outras entregas históricas com checkouts incompletos. |
| Limpeza do instalador de teste | CREATE ROLE e GRANT separados dentro de try, com role_created controlando finally. Falha no GRANT remove o papel recém-criado; falha na criação ou papel preexistente não dispara remoção indevida. Três testes de falha controlada passaram. |
| Falso positivo no login concorrente | O helper captura o resultado da conexão A e exige OK no caso loginfirst. Também confere duas sessões registradas antes da verificação final de revogação. Evita passar quando o login nem chegou a abrir a sessão. |
| Presença dos eventos de auditoria | Além da autoria SYSTEM, a regressão exige INSERT/AFTER da emissão e pares UPDATE BEFORE/AFTER correlacionados para consumo e invalidação. O enum real usa INSERT, não CREATE. |

## O que não foi aplicado literalmente

Nenhum dos oito apontamentos foi descartado por ser incorreto. Algumas sugestões foram adaptadas:

- Não bastava trocar DO UPDATE por DO NOTHING no mesmo ponto da carga: a descoberta genérica já teria criado placeholders. A ordem foi corrigida para preservar tanto o primeiro carregamento quanto as revisões humanas.
- Não alteramos ck_users_email nem corrigimos cadastros existentes: o ajuste necessário é a seleção segura no fluxo de recuperação, sem impor nova regra global de cadastro.
- Não removemos grants desconhecidos automaticamente: a execução falha para permitir revisão explícita, seguindo o padrão de segurança do projeto.
- Não criamos novos perfis, endpoints ou mudanças nas regras de validade/limites da recuperação.

## Evidências e limitação da validação

Passaram nesta revisão: compilação Python, quatro testes auxiliares, instalação sem SUPERUSER, instalação principal/catálogo/roles, migração da referência anterior, teste real de ACL externa, preservação dos metadados humanos e regressão SQL de recuperação (incluindo e-mails legados e eventos de auditoria). Os logs atuais desses testes estão em coverage/.

A execução integrada foi interrompida pela indisponibilidade do Docker. Ao tentar retomar, o backend do Docker Desktop falhou na inicialização do Inference manager. Nenhuma configuração de instalação, reset de fábrica ou exclusão de dados do Docker foi realizada.

Portanto, **não foi confirmado o término da suíte completa desta revisão**, especialmente o teste concorrente atualizado. `coverage/plpgsql-profile.json`, `coverage/postgresql.xml` e o log de concorrência de recuperação ainda pertencem à execução anterior e não são apresentados como evidência das correções atuais.

Quando o Docker estiver funcional, repetir `python PostgreSQL/tests/run_ci.py` em uma base descartável vazia. O container desta revisão, `olius-password-reset-comments`, foi criado sem rede e sem portas públicas; sua remoção não pôde ser confirmada enquanto o motor estava indisponível. Não o confundir com o banco de desenvolvimento da API.

Nenhum banco DEV/Aiven/produção foi alterado. Não houve commit, push, comentário, resolução de thread ou aprovação automática no GitHub.

## Arquivos

- PostgreSQL/04_functions_procedures.sql e migrations/20261101_password_reset.sql: filtro de e-mail seguro e migração coerente; ACL também na migração.
- PostgreSQL/access_control/01_roles.sql: validação de ACLs e overloads.
- PostgreSQL/data_catalog/04_load.sql: ordem, existência física e preservação de revisão humana.
- PostgreSQL/tests/run_ci.py: dependências e integração dos novos testes.
- PostgreSQL/tests/password_reset_regression.sql: regressões de e-mail e auditoria.
- PostgreSQL/tests/password_reset_concurrency.py: validação da conexão A e da sessão criada.
- PostgreSQL/tests/password_reset_migration_regression.py: limpeza em falhas e regressão do catálogo.
- PostgreSQL/tests/password_reset_access_review.py e test_password_reset_review.py: novos testes de ACL e falhas/dependências.
- PostgreSQL/PASSWORD_RESET.md: sincronização do contrato com as proteções adicionadas.
- PostgreSQL/PASSWORD_RESET_REVIEW.md: este relatório.
