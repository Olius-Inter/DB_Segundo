# Controle de acesso — OLIUS

Esta pasta centraliza os papéis PostgreSQL, as permissões sobre os objetos do banco e as contas da equipe e da Core API. A configuração corresponde aos scripts atuais e tem como alvo PostgreSQL 16.15.

## Arquivos e ordem de execução

| Arquivo | Responsabilidade |
|---|---|
| `01_roles.sql` | Cria e valida os papéis, aplica permissões, transfere a propriedade dos objetos previstos e configura os acessos de autenticação. |
| `02_users.sql` | Cria as sete contas aprovadas e atribui seus papéis, sem definir senhas. |

Executar nesta ordem, no banco do OLIUS do segundo ano:

1. Os cinco scripts principais do banco, de `01_structure.sql` a `05_triggers.sql`.
2. Os scripts de estrutura, constraints, view e carga da pasta `data_catalog`.
3. `access_control/01_roles.sql`.
4. `access_control/02_users.sql`, quando for provisionar as contas.

O catálogo precisa existir porque `01_roles.sql` também administra suas tabelas e sua view. Os registros em `data_catalog_role` documentam os papéis; a criação e as concessões efetivas ficam nesta pasta.

Executar cada arquivo completo, fora de outra transação. Ambos utilizam BEGIN/COMMIT. Se ocorrer erro, executar ROLLBACK antes de corrigir e repetir. Nenhum arquivo conecta automaticamente ao Aiven.

## Papéis e contas

Os **sete papéis** abaixo são `NOLOGIN`: representam permissões ou propriedade técnica e não iniciam uma conexão. As contas da equipe e da API são `LOGIN` e recebem participação nesses papéis.

Os perfis ADMIN, CITIZENS e ESTABLISHMENT da aplicação são registros do sistema e não equivalem automaticamente a esses papéis PostgreSQL.

| Papel | Finalidade e acessos configurados |
|---|---|
| `olius_owner` | Administração dos dados e da estrutura dos objetos OLIUS listados no script: tabelas, view documental, enums e rotinas comuns. Possui privilégios de tabelas com possibilidade de delegação e CREATE/USAGE no schema public. |
| `olius_reader` | Consulta ao conjunto operacional aprovado, a quatro colunas de users e à documentação. Sem concessão de escrita. |
| `olius_auditor` | Consulta aos 22 logs de negócio aprovados e à documentação. Sem concessão de escrita nos logs. |
| `olius_catalog_editor` | SELECT, INSERT, UPDATE e DELETE nas três tabelas documentais; SELECT na view. Sem concessão adicional sobre dados de negócio. |
| `olius_api` | Consultas de negócio, escrita cadastral/financeira por coluna e EXECUTE nas operações públicas. Sem escrita livre em fatos derivados, saldos, sessões ou logs; contrato completo em API_DATABASE_CONTRACT.md. |
| `olius_auth_owner` | Proprietário interno das funções de autenticação, com os privilégios restritos necessários à sua execução. Não é um perfil atribuído às contas da equipe ou da API. |
| `olius_business_owner` | Proprietário interno das procedures de negócio, entradas operacionais e triggers de auditoria/sincronização de PEV. Sem login, sem propriedade de tabelas e sem participação atribuída à Core ou à equipe. |

Os cinco perfis gerais recebem CONNECT no banco selecionado e USAGE no schema public. O proprietário interno recebe USAGE e os acessos necessários às suas funções. Nenhum desses grupos recebe SUPERUSER, CREATEDB, CREATEROLE, REPLICATION ou BYPASSRLS.

### `olius_owner`

Recebe ALL PRIVILEGES WITH GRANT OPTION sobre os objetos da lista fechada do script. Além dos privilégios, o script transfere a propriedade de:

- 55 tabelas da aplicação/auditoria, três tabelas documentais e `vw_data_catalog`;
- 22 tipos enum do projeto;
- 11 funções comuns explicitamente listadas. As dez procedures e duas funções de trigger de negócio passam ao proprietário interno.

A propriedade permite manutenção estrutural, como ALTER e DROP, que GRANT ALL sozinho não concede. Banco, schema e objetos de extensões não têm sua propriedade transferida.

O grupo também pode executar as cinco funções de integração de autenticação. As oito funções pertencentes a `olius_auth_owner` permanecem com esse proprietário restrito.

Pedro e Caio são administradores confiáveis dos dados: a propriedade das tabelas permite alterar sua estrutura e triggers. A separação do proprietário das funções de autenticação protege principalmente os acessos da API e dos leitores; não elimina os poderes de manutenção das tabelas concedidos aos administradores.

### `olius_reader`

SELECT integral nas seguintes tabelas:

| Área | Tabelas |
|---|---|
| Catálogos de referência | `establishment_type`, `subscription_plan`, `collection_failure_reason`, `certificate_level` |
| Operação | `subscription_cycle`, `collection_request`, `collection`, `delivery_pev` |
| Pontos e certificados | `point_calculation`, `point_transaction`, `certificate` |

Em `users`, SELECT somente nas colunas **id, name, user_type e status**. Não recebe SELECT geral que exponha password_hash.

Também consulta `data_catalog_table`, `data_catalog_column`, `data_catalog_role` e `vw_data_catalog`. A leitura das tabelas operacionais inclui seus campos de observação; não existe filtragem adicional de linhas nesta configuração.

### `olius_auditor`

SELECT nos seguintes logs:

| Área | Tabelas |
|---|---|
| Cadastros e PEV | `users_log`, `addresses_log`, `user_qr_code_log`, `citizens_log`, `establishment_log`, `pev_log` |
| Planos e ciclos | `subscription_plan_log`, `establishment_subscription_log`, `subscription_cycle_log` |
| Cobranças e pagamentos | `billing_order_log`, `billing_charge_log`, `payment_log`, `payment_application_log`, `payment_refund_log` |
| Coletas e entregas | `collection_request_log`, `collection_log`, `collection_failure_reason_log`, `collection_failure_log`, `delivery_pev_log` |
| Pontos e certificados | `point_calculation_log`, `certificate_level_log`, `certificate_log` |

Também consulta as três tabelas documentais e a view. **`auth_session_log` não está incluída** no conjunto aprovado para esse papel.

### `olius_catalog_editor`

Mantém os registros de `data_catalog_table`, `data_catalog_column` e `data_catalog_role` com SELECT/INSERT/UPDATE/DELETE e consulta `vw_data_catalog`.

Alterar um registro documental não cria uma role, não concede permissões e não modifica a estrutura descrita. Este papel não administra contas PostgreSQL.

### `olius_api`

A Core consulta 30 tabelas de negócio; escreve somente nas colunas autorizadas de cadastros e integração financeira. Não tem SELECT direto em logs, sessões, refresh tokens ou catálogo. DELETE somente em telephone. A leitura de users.password_hash serve ao login e não autoriza expor hashes em respostas HTTP.

Recebe EXECUTE nas três funções de consulta, oito procedures públicas de negócio, cinco funções de autenticação e quatro entradas operacionais: record_collection_arrival, accept_collection_service, reject_collection_request e set_billing_charge_external_status.

Não recebe EXECUTE em rebuild_user_points, reconcile_establishment_certificates ou auxiliares/triggers. Não pode alterar diretamente saldos, is_pev, pedidos, coletas, entregas, ciclos, revisões, cotação congelada ou pagamentos existentes.

O detalhamento por tabela/coluna e rotina está em [API_DATABASE_CONTRACT.md](API_DATABASE_CONTRACT.md). A autorização por usuário, JWT, titularidade e autenticação de pagamentos pertence à Core. A role técnica não implementa RLS nem distingue usuários HTTP.

### `olius_business_owner`

NOLOGIN e sem herança. Possui as dez procedures existentes, quatro funções operacionais e as duas funções de trigger de auditoria e sincronização de PEV. As oito procedures públicas, quatro entradas e duas triggers usam SECURITY DEFINER com search_path seguro; as duas procedures internas permanecem SECURITY INVOKER.

Recebe consultas necessárias, alterações restritas aos objetos que as rotinas mantêm e INSERT nos 22 logs de negócio. Não recebe acesso às tabelas de autenticação, ao catálogo nem CREATE permanente no schema. A função genérica de snapshots permanece SECURITY INVOKER e não é concedida à API.

olius_owner pode executar as rotinas de negócio, inclusive manutenção interna, mas não é proprietário dessas rotinas privilegiadas. Alterá-las exige a conta de implantação com autoridade sobre o proprietário interno. Nenhuma conta de 02_users.sql recebe esse papel.

### `olius_auth_owner`

| Objeto | Privilégios concedidos |
|---|---|
| `auth_session`, `auth_refresh_token` | SELECT, INSERT e UPDATE. |
| `auth_session_log` | INSERT para a auditoria dedicada. |
| `users` | SELECT(id, user_type, status) e UPDATE(id). |

UPDATE(id) permite os bloqueios usados por SELECT FOR UPDATE; as funções não alteram o identificador do usuário.

É proprietário de `auth_idle_duration`, das cinco funções de integração e de `fn_olius_auth_session_audit` e `fn_olius_auth_user_inactive`. CREATE no schema é concedido temporariamente para a transferência e revogado ao final.

Nenhuma conta definida em `02_users.sql` recebe participação nesse papel. A Core recebe EXECUTE nas funções por meio de `olius_api`.

## Contas configuradas

| Conta LOGIN | Papel recebido | Uso |
|---|---|---|
| `pedro` | `olius_owner` | Administração e manutenção do banco OLIUS. |
| `caio` | `olius_owner` | Administração e manutenção do banco OLIUS. |
| `matheus` | `olius_reader` | Consulta aos dados autorizados e à documentação. |
| `guilherme` | `olius_reader` | Consulta aos dados autorizados e à documentação. |
| `david` | `olius_reader` | Consulta aos dados autorizados e à documentação. |
| `erick` | `olius_reader` | Consulta aos dados autorizados e à documentação. |
| `olius_core_api` | `olius_api` | Conexão exclusiva do backend da Core API. |

As sete contas são criadas com LOGIN/INHERIT e sem privilégios administrativos globais. Membership usa INHERIT TRUE, SET TRUE e ADMIN FALSE: recebem os acessos do grupo, podem assumir o grupo, mas não recebem autorização para delegá-lo a outras contas.

Nenhuma conta é criada para o grupo auditor/editor nesta versão; esses papéis ficam disponíveis para atribuições futuras aprovadas. A segunda API também não tem uma conta definida nesta entrega.

## Senhas, reaplicação e manutenção

- Contas novas são criadas **sem senha**. Configure as credenciais separadamente no ambiente; não grave senhas reais nos scripts ou no GitHub. A credencial de olius_core_api deve ficar no backend da Core.
- Reaplicar `02_users.sql` não modifica senhas existentes. Contas preexistentes sem a marca de gerenciamento esperada, atributos privilegiados ou memberships extras causam erro e rollback para revisão.
- A marca das contas pessoais conserva o nome antigo `data_catalog/08_users.sql` por compatibilidade com provisionamentos anteriores; o arquivo executado atualmente é `access_control/02_users.sql`.
- `01_roles.sql` restaura a matriz dos grupos/PUBLIC nos objetos listados, incluindo permissões por coluna. Ampliações manuais devem ser versionadas antes de reaplicar; cadeias incompatíveis falham sem CASCADE.
- Ao criar novos objetos compartilhados, Pedro/Caio devem usar SET ROLE olius_owner para que a propriedade pertença ao grupo. Objetos novos não recebem SELECT automático para leitores; funções novas criadas como olius_owner não recebem EXECUTE público automático.

Os acessos descritos são os configurados pelos scripts. Outros grants, propriedade, PUBLIC ou memberships externos existentes no servidor podem ampliar acessos; REVOKE não é uma proibição absoluta.

## Implantação em servidor compartilhado

A conta de implantação precisa de CREATEROLE, autoridade sobre os objetos/schema, capacidade de conceder CONNECT e de transferir funções aos proprietários previstos (incluindo SET ROLE olius_business_owner). Atribuir os grupos às contas exige ADMIN OPTION nos grupos correspondentes. Esses poderes não são concedidos automaticamente a Pedro/Caio pelo script de contas.

Roles e contas são globais ao servidor. Os scripts alteram objetos somente no banco selecionado e não modificam ACLs de outros bancos. Outro banco pode conceder CONNECT ou acessos por PUBLIC; `02_users.sql` termina com um relatório de CONNECT para conferência. Verifique os acessos ao banco do primeiro ano antes de liberar credenciais no Aiven.

Na instalação inicial das funções de autenticação, a autoridade da conta de implantação sobre o parâmetro `app.audit_actor` também precisa ser conferida; consulte a documentação de sessões e os resultados anteriores de validação.

## Validação e situação da entrega

A configuração foi testada em PostgreSQL 16.15 descartável: criação/reaplicação, contas individuais, permissões permitidas/negadas e regressão de autenticação. A consolidação dos antigos scripts 06/07 preservou as permissões efetivas. A conta olius_core_api foi validada quanto à execução autorizada e ao bloqueio de acesso aos hashes de refresh tokens e ao auth_owner. A Core lê password_hash em users para autenticação.

Essas execuções foram locais, sem implantação no Aiven e sem integração dos testes novos ao CI. A existência dos scripts não significa que as contas já estejam criadas no servidor real.

A ampliação do contrato da Core foi validada com as oito procedures públicas, pontos/certificados/auditoria derivados, entradas operacionais e bloqueios da conta olius_core_api. Novas funções operacionais estão no script principal 04; todas as concessões e atributos SECURITY DEFINER são centralizados em 01_roles.sql. Após reinstalar 04/05, reaplicar as permissões antes de liberar tráfego.
