# OLIUS — documentação da entrega de autenticação

Esta entrega acrescenta persistência de sessões, rotação de refresh tokens, revogação e auditoria ao PostgreSQL do OLIUS. As regras de negócio anteriores foram preservadas.

Uma **sessão** representa um login. O **refresh token** permite renovar esse login. A **auditoria** registra como a sessão foi criada, renovada e revogada.

Os scripts principais passam de 52 para **55 tabelas: 32 base e 23 de auditoria**. As tabelas do catálogo de dados, instaladas separadamente, não entram nessa contagem.

## 1. `01_structure.sql` — estruturas e relacionamentos

### `auth_session`: um registro por login

Separar sessão de usuário permite que uma pessoa tenha logins diferentes no celular e no computador. Encerrar uma sessão não precisa encerrar as demais. Não há `UNIQUE(user_id)` nem limite de dispositivos.

| Campo | Tipo | Finalidade e motivo da escolha |
|---|---|---|
| `id` | UUID, PK | Identifica a sessão e corresponde ao `sid` do JWT. Segue a convenção de identificadores do projeto. |
| `user_id` | UUID, FK, obrigatório | Liga a sessão ao titular em `users`, sem duplicar e-mail, CPF, senha ou perfil. |
| `created_at` | TIMESTAMPTZ, obrigatório | Preserva o instante do login inicial. Não muda durante renovações. |
| `last_renewed_at` | TIMESTAMPTZ, obrigatório | Registra o login inicial ou a última renovação bem-sucedida. É a referência de atividade aprovada. |
| `idle_expires_at` | TIMESTAMPTZ, obrigatório | Guarda o prazo vigente por inatividade. A validade depende da comparação com o horário atual. |
| `revoked_at` | TIMESTAMPTZ, opcional | Indica quando ocorreu o encerramento antecipado. Nulo significa ausência de revogação, não necessariamente sessão válida. |
| `revocation_reason` | `auth_revocation_reason_t`, opcional | Registra um dos motivos aprovados para revogação. É preenchido junto de `revoked_at`. |
| `updated_at` | TIMESTAMPTZ, obrigatório | Registra a última alteração, inclusive revogação. Por isso difere da última renovação. |

`TIMESTAMPTZ` representa instantes comparáveis entre conexões com fusos diferentes. A rotina preenche os horários iniciais usando a mesma referência temporal.

O novo ENUM `auth_revocation_reason_t` aceita:

| Valor | Significado |
|---|---|
| `LOGOUT` | Encerramento solicitado pelo titular. |
| `ACCOUNT_INACTIVE` | Revogação decorrente da inativação da conta. |
| `REFRESH_REUSE` | Reutilização detectada de refresh token consumido. |

Não existe status `EXPIRED`: o relógio determina a expiração. Isso evita depender de uma tarefa periódica para bloquear uma sessão cujo prazo terminou. Uma sessão com `revoked_at` nulo ainda pode estar expirada.

### `auth_refresh_token`: histórico de emissões

Cada linha representa uma emissão, incluindo as já consumidas. Substituir apenas o hash atual apagaria a informação necessária para reconhecer um token antigo apresentado novamente.

| Campo | Tipo | Finalidade e motivo da escolha |
|---|---|---|
| `id` | UUID, PK | Identificador interno da emissão. Não é o segredo entregue ao cliente. |
| `session_id` | UUID, FK, obrigatório | Identifica a sessão e a família de tokens. Não é necessário outro identificador de família. |
| `token_hash` | BYTEA, obrigatório | Armazena os 32 bytes do SHA-256. O segredo original nunca é armazenado. |
| `generation` | BIGINT, obrigatório | Numera as emissões: 1, 2, 3… O inteiro de grande capacidade comporta sessões continuamente renovadas. |
| `issued_at` | TIMESTAMPTZ, obrigatório | Instante da emissão específica. |
| `expires_at` | TIMESTAMPTZ, obrigatório | Prazo atribuído na emissão, preservado mesmo após outras renovações. |
| `consumed_at` | TIMESTAMPTZ, opcional | Instante de uso para renovação. Só pode passar de nulo para preenchido uma vez. |

`BYTEA` guarda o hash binário diretamente, sem exigir a representação hexadecimal de 64 caracteres. A Core gera um segredo com pelo menos 32 bytes de aleatoriedade criptográfica e calcula seu SHA-256; o banco não comprova a aleatoriedade do segredo.

| Garantia estrutural | Motivo |
|---|---|
| `UNIQUE(token_hash)` | Um hash não pode identificar duas emissões. |
| `UNIQUE(session_id, generation)` | Uma sessão não pode ter duas emissões com o mesmo número. |
| `uq_auth_refresh_unconsumed` sobre `session_id`, com `consumed_at IS NULL` | Garante no máximo um token não consumido por sessão. |

O índice único parcial fica no script 01 porque é uma garantia de integridade. Token não consumido não equivale a token válido: ainda é necessário conferir os prazos, a sessão e a conta.

Depois de uma renovação, a geração 1 permanece consumida e a geração 2 fica disponível. O hash e a expiração da geração 1 não são sobrescritos.

Os relacionamentos são **usuário 1:N sessões** e **sessão 1:N emissões de token**. As FKs usam `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`. Logout e expiração não apagam o histórico.

### `auth_session_log`: auditoria da sessão

Permite identificar criação, renovação, revogação, motivo e autoria. `LIKE auth_session` copia a definição dos campos da sessão para armazenar seus snapshots; não mantém uma ligação dinâmica com futuras mudanças da tabela original.

O `id` copiado identifica a sessão auditada. A PK do log é `log_id`, porque a mesma sessão possui vários snapshots.

| Campo adicional | Finalidade |
|---|---|
| `log_id` | Identificador único do snapshot. |
| `audit_event_id` | Agrupa os retratos de uma operação, principalmente o antes e o depois do UPDATE. |
| `snapshot_kind` | Indica `BEFORE` ou `AFTER`. |
| `operation` | Indica INSERT, UPDATE ou DELETE. |
| `performed_at` | Instante da gravação do snapshot. |
| `performed_by` | Autor autenticado, quando houver, com FK para `users`. |
| `actor_kind` | Distingue `USER` de `SYSTEM`. |
| `operational_driver_id` | Mantido para compatibilidade com o padrão de auditoria, mas obrigatoriamente nulo neste log. |
| `audit_reason` | Explicação da ação. |
| `changed_columns` | Lista dos campos alterados no UPDATE. |

`user_id` é o **titular da sessão**; `performed_by` é o **autor da ação**. Um administrador que inativa um cidadão é um autor diferente do titular.

A unicidade `(audit_event_id, id, snapshot_kind)` impede duplicar um lado do retrato para a mesma sessão e evento. Não há tokens ou hashes nesse log.

Não foi criada `auth_refresh_token_log`: emissão e consumo já são preservados na tabela operacional, com proteção de imutabilidade.

### Papéis técnicos — configuração separada na entrega `data_catalog`

| Papel | O que representa |
|---|---|
| `olius_api` | Grupo de permissões da Core API, que solicita as operações autorizadas. |
| `olius_auth_owner` | Proprietário técnico das funções de autenticação, com os privilégios restritos usados durante sua execução. |

Ambos são `NOLOGIN`. Não são contas com senha nem perfis ADMIN/CITIZENS/ESTABLISHMENT. A conta LOGIN real da Core recebe `olius_api`; não recebe `olius_auth_owner`.

**Por que criar `olius_auth_owner`?** Para que a Core consiga pedir uma renovação sem receber autorização para alterar livremente hashes, prazos ou logs. Também evita executar essas funções com todos os poderes de uma conta administrativa.

Exemplo: a Core chama `rotate_auth_refresh_token` como `olius_api`. O PostgreSQL executa o código autorizado com os privilégios limitados de `olius_auth_owner`. Ao terminar, esses privilégios não ficam disponíveis para a Core executar outros comandos.

Apesar do nome owner, ele **não é proprietário do banco nem das tabelas**. É proprietário das funções específicas e recebe privilégios selecionados sobre as tabelas:

- SELECT, INSERT e UPDATE em `auth_session` e `auth_refresh_token`;
- somente INSERT em `auth_session_log`;
- SELECT de `id`, `user_type` e `status` em `users`;
- UPDATE de `id` em `users`, necessário para permitir `SELECT FOR UPDATE`. As funções não alteram `users.id`.

A Core recebe EXECUTE nas cinco funções de integração, não DML direto nessas tabelas. Executar funções de autenticação é uma responsabilidade esperada de `olius_api`; o risco seria permitir chamadas indevidas pela API. Por exemplo, `open_auth_session` confia que a Core já verificou a senha. Essa divisão de papéis não substitui autenticação e autorização no backend.

O arquivo `access_control/01_roles.sql` cria as roles quando ausentes e rejeita atributos privilegiados ou heranças incompatíveis quando já existem. Não cria contas LOGIN, senhas ou memberships para integrantes. Roles são globais ao servidor, mesmo quando seus privilégios são concedidos em objetos deste banco.

## 2. `02_check_constraints.sql` — coerência dos registros

| Constraint | Regra garantida e justificativa |
|---|---|
| `ck_auth_session_dates` | Instantes finitos; renovação não anterior à criação; expiração posterior à renovação; atualização e revogação não anteriores à criação. Evita cronologia incoerente. |
| `ck_auth_session_revocation` | Data e motivo de revogação presentes juntos ou ambos ausentes. |
| `ck_auth_refresh_hash` | Hash com exatamente 32 bytes. Valida tamanho, não a entropia do segredo original. |
| `ck_auth_refresh_generation` | Geração positiva. O próximo número exato é determinado pela rotina. |
| `ck_auth_refresh_dates` | Emissão e expiração finitas, expiração posterior à emissão e consumo dentro de `[issued_at, expires_at)`. |
| `ck_auth_session_log_snapshot` | INSERT usa AFTER; DELETE usa BEFORE; UPDATE admite os dois. A trigger produz o par. |
| `ck_auth_session_log_actor` | USER exige autor; SYSTEM exige ausência de autor; motorista não é permitido. |
| `ck_auth_session_log_performed_at` | Data de auditoria finita. |

O ENUM já restringe os motivos de revogação; não se duplica essa lista em CHECK.

Não se usa `now()` em CHECK para representar validade: uma linha não é revalidada automaticamente quando o relógio avança. A validade atual e as regras entre tabelas são verificadas pelas rotinas.

## 3. `03_indexes.sql` — consultas e desempenho

| Índice | Definição | Justificativa |
|---|---|---|
| `idx_auth_session_user_created` | `(user_id, created_at DESC)` | Localiza sessões de um titular e permite ordená-las das mais recentes para as mais antigas. Também apoia operações por usuário. |
| `idx_auth_session_unrevoked_expiry` | `(idle_expires_at) WHERE revoked_at IS NULL` | Apoia consultas e manutenção futura por prazo entre sessões ainda não revogadas. |
| `idx_auth_session_log_history` | `(id, performed_at DESC)` | Recupera o histórico de uma sessão, começando pelos registros mais recentes. |

O índice de expiração não encerra sessões nem exige manutenção periódica para bloqueá-las. Não utiliza horário atual no predicado.

Não foram duplicados os índices de hash e de sessão/geração: os UNIQUEs do script 01 já fornecem esses acessos. Cada índice aumenta armazenamento e custo de escrita, por isso sua inclusão precisa de finalidade concreta.

## 4. `04_functions_procedures.sql` — rotinas

Foram acrescentadas cinco funções de integração e uma interna. Funções PostgreSQL podem realizar escritas. A escolha permite retornar resultados controlados, IDs e prazos; a Core controla a transação. Não são necessárias Window Functions para esse mecanismo.

### `auth_idle_duration`: prazo centralizado

Recebe `p_user_type user_type_t` e retorna INTERVAL: ADMIN = **168 horas**; CITIZENS/ESTABLISHMENT = **360 horas**. A Core não tem EXECUTE direto nessa função interna.

Horas representam duração decorrida, inclusive atravessando mudanças de horário de verão. Centralizar o cálculo evita divergências entre abertura e renovação. Perfil e prazo vêm do banco, não de escolhas livres do cliente.

### `open_auth_session`: login inicial

Entradas: `p_user_id UUID` e `p_token_hash BYTEA`.

Valida o hash, bloqueia e confere o usuário ativo, calcula o prazo, cria a sessão e registra o token de geração 1. Retorna `result_code`, `session_id` e `expires_at`.

Resultados: `OK`, `INVALID_INPUT` ou `USER_UNAVAILABLE`. Não verifica senha nem assina JWT: a Core só pode chamá-la depois de autenticar a pessoa. Sessão e primeiro token são persistidos na mesma transação.

### `rotate_auth_refresh_token`: renovação atômica

Entradas: `p_token_hash BYTEA` e `p_next_token_hash BYTEA`. Retorna `result_code`, `session_id`, `user_id` e `expires_at`; IDs e prazo só retornam em sucesso.

A rotina localiza o token e bloqueia **usuário → sessão → token**. Relê os dados e obtém o horário depois dos bloqueios. Isso evita aceitar renovação com um horário capturado antes de uma espera prolongada.

No caminho válido, consome o token atual, insere o sucessor com geração seguinte e atualiza a última renovação e a expiração da sessão. O novo token recebe o mesmo novo prazo; os anteriores mantêm seus prazos originais.

Resultados esperados: `OK`, `INVALID_INPUT`, `INVALID_TOKEN`, `USER_INACTIVE`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `TOKEN_EXPIRED` e `REFRESH_REUSED`.

Uma sessão revogada ou expirada é rejeitada. Na sessão ainda vigente, a apresentação de token consumido revoga a sessão como `REFRESH_REUSE`, inclusive quando o sucessor informado é inválido. Token desconhecido não revoga uma sessão arbitrária.

**REFRESH_REUSED exige confirmar a transação antes de responder erro HTTP.** A função retorna um resultado controlado, pois lançar uma exceção depois da revogação poderia desfazê-la. Falhas inesperadas de banco, por outro lado, exigem rollback e não são transformadas em sucesso.

A política é estrita: duas apresentações do mesmo token não terão sucesso. A segunda pode revogar a sessão. Se a primeira operação confirmou e sua resposta foi perdida, pode ser necessário novo login. Não há janela de tolerância ou reemissão do segredo.

### `revoke_auth_session`: logout individual

Recebe `p_user_id UUID` e `p_session_id UUID`. Confere a titularidade e registra revogação com motivo LOGOUT, sem apagar dados.

Retorna TEXT: `OK`, `ALREADY_REVOKED` ou `INVALID_SESSION`. Repetir um logout não substitui o motivo anterior. O ID do usuário deve vir da identidade autenticada pela Core.

### `revoke_user_auth_sessions`: logout em lote

Recebe `p_user_id UUID` e revoga as sessões ainda não revogadas do titular autenticado, com motivo LOGOUT. Retorna `result_code` e `revoked_count`: `OK` com a quantidade afetada, inclusive zero, ou `USER_UNAVAILABLE`.

Inativação de conta usa a trigger própria do script 05 e o motivo ACCOUNT_INACTIVE.

### `get_auth_session_status`: validade sem renovação

Recebe `p_user_id UUID` e `p_session_id UUID`, correspondentes a sub/sid do JWT. Confere vínculo, conta ativa, ausência de revogação e prazo vigente.

Retorna uma linha com `is_valid`, `user_status`, `user_type` e `idle_expires_at`. Vínculo inexistente produz FALSE e dados nulos. Consultar a sessão não altera sua atividade nem prorroga o prazo.

Isso permite bloquear acesso antes dos 15 minutos do JWT, desde que a Core consulte e respeite o resultado. A verificação reflete o estado visível no instante da consulta; não desfaz operações já autorizadas.

### Execução restrita e contexto

As cinco funções de integração usam SECURITY DEFINER. Após configurar `access_control/01_roles.sql`, seu proprietário é `olius_auth_owner`. Possuem `search_path` fixo em `pg_catalog, pg_temp` e referências qualificadas para os objetos da aplicação. O uso de `public.` identifica explicitamente o objeto acessado por código privilegiado.

Nos scripts principais, EXECUTE público é retirado. Exclusivamente em `access_control/01_roles.sql`, `olius_api` recebe as cinco funções de integração e a propriedade das funções é transferida ao owner. CREATE no schema é concedido temporariamente para essa transferência e retirado ao final.

As funções de escrita configuram autoria localmente e restauram o contexto anterior ao sair, inclusive em exceções. Isso evita deixar a identidade de uma chamada nas conexões reutilizadas pelo pool. Para outras operações, como inativação, a Core deve fornecer contexto coerente com SET LOCAL.

## 5. `05_triggers.sql` — proteções automáticas

| Trigger | Tabela e momento | Finalidade |
|---|---|---|
| `trg_auth_token_guard` | auth_refresh_token, BEFORE UPDATE/DELETE | Protege campos originais, permite consumo único e bloqueia exclusão. |
| `trg_auth_token_no_truncate` | auth_refresh_token, BEFORE TRUNCATE | Impede esvaziar o histórico por um comando de tabela inteira. |
| `trg_auth_session_guard` | auth_session, BEFORE UPDATE | Protege identidade/criação e impede recuperar uma sessão revogada. |
| `trg_auth_session_updated_at` | auth_session, BEFORE UPDATE | Reutiliza a função existente para manter updated_at. |
| `trg_auth_session_audit` | auth_session, AFTER INSERT/UPDATE/DELETE | Registra os retratos finais da operação. |
| `trg_auth_user_inactive` | users, AFTER UPDATE OF status | Ao mudar efetivamente para INACTIVE, revoga sessões ainda não revogadas. |

### Proteção dos tokens e sessões

`fn_olius_auth_token_guard` impede alterar ID, sessão, hash, geração, emissão e expiração. A única atualização admitida é consumed_at de nulo para preenchido; uma vez consumido, nem esse instante pode mudar. O CHECK complementa a trigger verificando a cronologia.

`fn_olius_auth_session_guard` impede alterar ID, titular ou criação. Depois da revogação, protege data/motivo da revogação e os prazos de renovação. Reativar a conta não recupera as sessões antigas: exige novo login.

Exclusão/limpeza de tokens dependerá de manutenção explicitamente definida. Não foi inventada uma política de retenção.

### Auditoria específica

`fn_olius_auth_session_audit` usa AFTER para capturar os valores finais, incluindo updated_at. INSERT gera AFTER; UPDATE gera BEFORE e AFTER com o mesmo audit_event_id; DELETE gera BEFORE.

A função é exclusiva de auth_session, sem nome de tabela livre recebido como parâmetro. Foi criada para não elevar os poderes da auditoria genérica existente. Somente essa função e a função de inativação usam o proprietário restrito entre as novas funções de trigger.

Login, renovação válida e logout registram USER. Reutilização suspeita registra SYSTEM, sem atribuir autoria autenticada ao titular. Inativação preserva o administrador que iniciou a ação ou o contexto SYSTEM. A trigger valida o formato do contexto; não autentica quem o forneceu.

### Inativação na mesma transação

`fn_olius_auth_user_inactive` executa quando users.status muda para INACTIVE. O UPDATE do usuário já mantém seu bloqueio; a função revoga suas sessões com ACCOUNT_INACTIVE, coordenada com os bloqueios das rotinas.

Se a inativação falhar e a transação for desfeita, suas revogações também são desfeitas. O script 05 não depende das funções de negócio do script 04 para essa proteção.

## Responsabilidades e limites da entrega

| Componente | Responsabilidade |
|---|---|
| Core API | Verificar senha, gerar segredos, calcular SHA-256, emitir/verificar JWT de 15 minutos, autenticar/autorizar, configurar cookies e respostas HTTP, confirmar transações. |
| PostgreSQL | Persistir sessões e hashes, validar integridade, coordenar rotação/revogação e auditar sessões. |
| Segunda API | Consultar a Core para verificar usuário/sessão; não acessar diretamente as tabelas nem compartilhar o papel da Core. |

O JWT contém sub/sid. Não são armazenados JWTs completos, refresh tokens originais, senhas em texto puro ou chaves privadas. Credenciais de olius_api ficam exclusivamente no backend da Core.

## Validações realizadas

Na entrega, os testes foram executados em PostgreSQL 16.15 descartável e isolado:

- instalação conjunta dos cinco scripts e contagem 55/32/23;
- rotação, reutilização, logout, revogação em lote, expiração, inativação e reativação;
- unicidades, hash de 32 bytes, imutabilidade e rollback sem gravações parciais;
- prazos de 168/360 horas, inclusive atravessando horário de verão;
- auditoria sem credenciais, separação de autor/titular e autoria SYSTEM na reutilização;
- permissões simulando a identidade olius_api: funções permitidas, hashes/DML/logs e adoção do owner negados;
- sete disputas concorrentes: refresh duplicado, refresh/inativação nas duas ordens, rollback, logout/refresh, expiração durante espera e login/inativação;
- regressão funcional das procedures de negócio anteriores.

Todos passaram. Não se trata de validação da conta LOGIN real do Aiven. Os testes concorrentes usam READ COMMITTED; outros isolamentos também exigem tratamento de erros de serialização na Core.

Os arquivos `tests/auth_sessions_regression.sql` e `tests/auth_sessions_concurrency.py` acompanham a entrega. São exclusivos de bases descartáveis. A integração deles ao CI não foi realizada nesta alteração.

## Implantação e pendências

Os cinco scripts criam uma base nova; editar os arquivos não migra bancos existentes. Nenhum script foi executado nos bancos de trabalho. Ambientes existentes exigem migração aditiva revisada dos novos tipos, tabelas, índices, constraints, papéis, funções e triggers, sem recriar as tabelas de negócio.

A conta de implantação precisa de autoridade para criar roles e transferir funções para olius_auth_owner. A conta LOGIN da Core precisa de CONNECT e membership adequado em olius_api. Não conceder o owner à aplicação. Grants herdados e ownership devem ser conferidos: REVOKE de PUBLIC/olius_api não remove direitos provenientes de outros papéis da conta.

A definição de papéis e concessões fica em `access_control/01_roles.sql`: executar os cinco scripts principais, o catálogo 01–05 e esse script de acesso. Os scripts principais não criam papéis. Antes da configuração de acesso, a integração não está liberada para a Core. Após reinstalar 04/05, reaplicar as permissões antes de liberar tráfego. Proprietários internos não são níveis adicionais do catálogo. Contas LOGIN e memberships são provisionados separadamente em `access_control/02_users.sql`. O contrato completo da Core está em `access_control/API_DATABASE_CONTRACT.md`.

Os testes de autenticação exigem também a configuração dos perfis. Nenhuma regra funcional de sessão foi alterada nesta separação.

Continuam pendentes a política de retenção/limpeza, a estratégia para eventuais sessões ou JWTs antigos e a confirmação dos privilégios reais no Aiven. Revogação por troca de senha ou perfil não foi implementada sem aprovação. O perfil atual determina o prazo na próxima renovação; não se altera silenciosamente um prazo já emitido.

Não há limite absoluto de duração da sessão nem limite de dispositivos nesta definição.

### Validação da separação dos perfis

Em PostgreSQL 16.15 descartável, os cinco scripts principais instalaram sem criar olius_api ou olius_auth_owner. A instalação do catálogo e do controle de acesso, incluindo reaplicação, passou nos testes funcionais, de integridade, auditoria, prazos e permissões de auth_sessions_regression.sql. Nenhum banco do projeto foi acessado.

## Contas pessoais e propriedade comum — entrega data_catalog

O arquivo `data_catalog/08_users.sql` configura separadamente as seis contas pessoais aprovadas, sem senhas no código. Pedro/Caio recebem olius_owner; Matheus/Guilherme/David/Erick recebem olius_reader. Nenhuma dessas contas recebe olius_auth_owner. Os objetos comuns são transferidos para olius_owner pelo script 06; as oito funções de autenticação continuam com o proprietário restrito definido no script 07. A conta LOGIN da Core não é criada pelo script das pessoas. Consulte `data_catalog/README.md` e os relatórios de validação para implantação e limites no servidor compartilhado.
