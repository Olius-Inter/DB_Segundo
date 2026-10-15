# Catálogo de Dados — OLIUS

Entrega de documentação PostgreSQL 16.15. Papéis e contas são configurados separadamente em access_control. O catálogo armazena metadados, nunca valores reais de senhas, tokens, CPF ou pagamentos.

## Organização

| Arquivo | Responsabilidade |
|---|---|
| `01_structure.sql` | Três tabelas documentais: tabelas, colunas e papéis. |
| `02_check_constraints.sql` | Integridade dos metadados. |
| `03_view.sql` | View de consulta com estrutura real e papéis elegíveis. |
| `04_load.sql` | Descrições revisadas, políticas e descoberta de objetos novos. |
| `05_validate.sql` | Consultas de cobertura e pendências; não modifica dados. |
| `upgrade_view.sql` | Substituição da versão anterior da view, quando necessária. |

Não há criação de contas ou definição de perfis nos cinco scripts principais do banco. Eles preservam os bloqueios de acesso público dos objetos sensíveis na criação.

## Instalação nova

1. Instalar os cinco scripts principais do PostgreSQL, de `01_structure.sql` a `05_triggers.sql`.
2. Conferir banco/schema selecionados. Este módulo usa o schema `public` do banco do segundo ano.
3. Executar os arquivos **01 a 05 desta pasta**, completos e na ordem numérica; depois `../access_control/01_roles.sql`.
4. Executar novamente `05_validate.sql`, agora com os papéis físicos presentes.
5. Executar `../access_control/02_users.sql` separadamente para provisionar as contas da equipe/Core.
6. Configurar as senhas fora dos arquivos versionados e conferir os acessos antes de liberar as contas.

Arquivos com BEGIN/COMMIT devem ser executados fora de outra transação. Se houver erro, usar ROLLBACK antes da correção/reexecução. Não reaplicar os CREATEs dos arquivos 01/02/03 sobre objetos existentes. Editar estes arquivos não migra automaticamente o banco instalado.

Nenhum arquivo se conecta automaticamente ao Aiven. Nesta revisão, a execução ocorreu somente em PostgreSQL descartável.

## Atualização de catálogo existente

- Se as três tabelas e a view simplificada já existem, reaplicar **04**, depois `../access_control/01_roles.sql`, e conferir com **05**. Provisionar contas separadamente se necessário.
- Se a view ainda tem o formato antigo, executar `upgrade_view.sql` antes. Ele faz DROP/CREATE sem CASCADE, preservando proprietário e concessões. Dependências ou grants incompatíveis causam erro para revisão.
- O controle de acesso está consolidado em `../access_control/01_roles.sql`, que também protege autenticação e operações de negócio.
- 04 preserva descrições humanas. A revisão preenche as 39 colunas descobertas como PENDING e as três tabelas de autenticação, substituindo apenas marcadores automáticos e textos versionados reconhecidos. Políticas personalizadas não são sobrescritas silenciosamente.

## Cobertura atual

**58 tabelas e 828 colunas documentadas:** 55 tabelas da aplicação/auditoria e três do catálogo. A view exclui as três tabelas documentais e apresenta **55 tabelas e 808 colunas distintas**. Existem 23 tabelas de auditoria no banco.

Não conte linhas da view para medir colunas: uma coluna pode aparecer uma vez para cada papel com acesso. A validação verifica ausência física, renomeações, metadados faltantes e campos pendentes. Novos objetos continuam sendo descobertos como PENDING até revisão; não recebem descrições de negócio inventadas.

O catálogo documenta tabelas e colunas. O comportamento das rotinas de sessão está detalhado em `../AUTH_SESSIONS.md`; esta entrega não cria um catálogo adicional de funções.

## Papéis, propriedade e contas

| Papel | Acesso configurado |
|---|---|
| `olius_owner` | Proprietário das tabelas, view documental, 22 enums e 11 funções comuns explicitamente listadas em access_control/01_roles.sql. Administra dados e estrutura. |
| `olius_reader` | SELECT no conjunto operacional aprovado, em quatro colunas de users e no catálogo. Sem escrita, hashes, tokens, dados financeiros restritos ou logs. |
| `olius_auditor` | SELECT nos 22 logs de negócio anteriormente aprovados e no catálogo. Não inclui automaticamente auth_session_log. |
| `olius_catalog_editor` | SELECT/INSERT/UPDATE/DELETE nas três tabelas documentais e leitura da view. |
| `olius_api` | Consultas de negócio, escrita limitada por coluna e EXECUTE nas operações públicas. Contrato completo em ../access_control/API_DATABASE_CONTRACT.md. |

`olius_auth_owner` é um proprietário interno NOLOGIN, não um sexto perfil da equipe. Mantém oito funções de autenticação: a auxiliar de prazo, cinco de integração e duas de trigger SECURITY DEFINER. Nenhuma das sete contas recebe participação nesse papel. `olius_owner` pode executar as cinco funções de integração, sem poder redefini-las por sua associação ao grupo comum.

access_control/01_roles.sql transfere a propriedade dos objetos listados para `olius_owner`: GRANT ALL sozinho não concede ALTER/DROP. Ele não usa REASSIGN OWNED, não transfere banco/schema/extensões e não assume controle de objetos arbitrários com base no catálogo documental editável.

Pedro e Caio são administradores confiáveis dos dados: propriedade permite alterar tabelas e triggers. A separação do auth_owner reduz a autoridade da API e separa manutenção das funções privilegiadas; não é uma barreira contra alguém autorizado a administrar as tabelas subjacentes.

| Conta LOGIN | Grupo |
|---|---|
| pedro | olius_owner |
| caio | olius_owner |
| matheus | olius_reader |
| guilherme | olius_reader |
| david | olius_reader |
| erick | olius_reader |
| olius_core_api | olius_api |

access_control/02_users.sql cria contas com LOGIN/INHERIT, sem SUPERUSER, CREATEDB, CREATEROLE, REPLICATION ou BYPASSRLS. Membership tem INHERIT/SET habilitados e ADMIN desabilitado. Inclui a conta olius_core_api. Não define senhas.

Contas novas não têm senha. Em autenticação por senha, precisam de configuração externa antes do uso; LOGIN sozinho não configura a autenticação do servidor. A reaplicação não altera senhas existentes. Nomes preexistentes sem a marca de gerenciamento OLIUS causam erro e rollback, assim como atributos ou memberships incompatíveis. O comentário identifica a origem operacional, não funciona como mecanismo de autenticação.

## Autoridade de implantação e manutenção

access_control/01_roles.sql exige autoridade nos objetos/schema, concessão de CONNECT e capacidade de transferir objetos para olius_owner e os proprietários internos olius_auth_owner/olius_business_owner. Criar grupos exige CREATEROLE; atribuir grupos em access_control/02_users.sql exige ADMIN OPTION nesses grupos. CREATEROLE sozinho não garante todas essas capacidades no PostgreSQL 16.

Não é necessário transformar Pedro e Caio em superusuários ou administradores do servidor. A conta de implantação autorizada deve satisfazer os pré-requisitos; eles não recebem automaticamente autoridade de provisionamento das contas. A disponibilidade desses poderes no Aiven precisa ser conferida antes da execução real.

Ao criar novos objetos compartilhados em public, Pedro e Caio devem usar `SET ROLE olius_owner` e depois `RESET ROLE`. Assim os objetos pertencem ao grupo, não a uma pessoa. Objetos novos não recebem acesso de leitura automaticamente; novas funções criadas como olius_owner não recebem EXECUTE público por padrão. Versionar concessões futuras explicitamente.

access_control/01_roles.sql restaura a matriz definida para os objetos listados, removendo concessões extras diretas, inclusive por coluna, das cinco roles/PUBLIC. Falha em cadeias incompatíveis sem CASCADE. Não elimina privilégios herdados de outros grupos ou direitos de proprietário; heranças dos grupos são verificadas.

## Servidor compartilhado com o primeiro ano

Papéis e contas são globais ao servidor. Estes scripts modificam objetos apenas no banco escolhido e não alteram ACLs de outros bancos. No entanto, outro banco pode conceder CONNECT a PUBLIC, e seus objetos podem ter concessões públicas próprias.

access_control/02_users.sql apresenta um relatório de CONNECT para as sete contas em todos os bancos visíveis. CONNECT não significa acesso às tabelas. Antes de fornecer credenciais no Aiven, conferir também privilégios dos objetos do primeiro ano. Restringir esse outro banco exige uma alteração própria e revisão dos usuários que já o utilizam; não foi executada nesta entrega.

## Como interpretar a view

`access_status` mostra uma role documental por linha, se ela existir e tiver USAGE no schema e acesso de dados à coluna/tabela. Considera SELECT/INSERT/UPDATE por coluna ou tabela e DELETE/TRUNCATE por tabela, inclusive herança efetiva e PUBLIC. REFERENCES/TRIGGER sozinhos não são acesso aos dados.

Sem role elegível, a coluna permanece com NULL. EXECUTE em função SECURITY DEFINER não é acesso direto à tabela e não faz olius_api aparecer como leitor de hashes de refresh tokens/sessões. Os proprietários internos de auth e negócio não são listados entre os cinco perfis documentais. A Core lê users.password_hash para login; isso é distinto de acesso a refresh tokens.

A descrição do papel informa sua finalidade geral; os privilégios concretos variam por objeto. A view não simula políticas RLS nem autenticação. Por usar security_invoker, exige leitura da view e das três tabelas documentais.

`data_catalog_table.access_status` mantém PENDING/DEFINED como estado documental. Não confundir com a coluna homônima da view, que apresenta o nome da role.

## Validação

Consulte `validation_report.md`, `../tests/catalog_access_regression.sql`. A revisão foi testada em PostgreSQL 16.15 descartável, incluindo atualização de catálogo antigo, reaplicação, contas individuais, preservação de metadados humanos e regressão de autenticação/negócio. O Aiven não foi acessado.

Referências: [privilégios e membership no PostgreSQL 16](https://www.postgresql.org/docs/16/sql-grant.html), [alteração da propriedade de funções](https://www.postgresql.org/docs/16/sql-alterfunction.html).

O proprietário interno olius_business_owner e as permissões detalhadas da Core são documentados em [../access_control/README.md](../access_control/README.md) e [../access_control/API_DATABASE_CONTRACT.md](../access_control/API_DATABASE_CONTRACT.md). O catálogo mantém cinco perfis documentais; não concede privilégios por seus registros.
