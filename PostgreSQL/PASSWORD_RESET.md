# Recuperação de senha — contrato PostgreSQL / Core

Referência: PostgreSQL 16.15, sessões com rotação, convites e proteção do último ADMIN já instalados. Esta entrega não altera Java nem executa migrações em bancos reais.

## Responsabilidades

A Core gera 32 bytes criptograficamente aleatórios, codifica Base64URL sem padding para o link e envia ao banco somente seu SHA-256 (BYTEA de 32 bytes). Calcula o hash da senha com o PasswordEncoder atual; nunca envia a senha original ao PostgreSQL. SMTP, limite por IP, validação da senha, URL pública e resposta HTTP pertencem à Core.

O banco atende CITIZENS, ESTABLISHMENT e ADMIN ativos. Motoristas não têm login. Recuperação não reativa conta, altera perfil, emite convite, abre sessão ou assina JWT.

## Emissão

`issue_password_reset(p_email TEXT, p_token_hash BYTEA, p_valid_for INTERVAL DEFAULT INTERVAL '30 minutes')`

Retorna exatamente uma linha: `result_code TEXT, reset_id UUID, user_id UUID, expires_at TIMESTAMPTZ`. Os três últimos são preenchidos apenas em OK.

| Resultado | Significado interno |
|---|---|
| OK | Emissão persistida; enviar e-mail somente após COMMIT. |
| INVALID_INPUT | E-mail/hash/prazo inválido ou data resultante fora da representação. |
| USER_UNAVAILABLE | Conta ausente, inativa ou identificação ambígua. |
| RATE_LIMITED | Menos de 60 segundos desde outra emissão, ou três emissões nos últimos 15 minutos. |
| HASH_CONFLICT | Hash já registrado; não foi criada outra emissão. |

Parte local do e-mail é comparada exatamente, inclusive caixa. Somente domínio é comparado em minúsculas. Não aplica LOWER ao endereço inteiro nem normaliza cadastros. Endereços armazenados com mais de um @ são ignorados na descoberta e na releitura sob lock, sem alterar o cadastro legado. Se dados legados contiverem mais de uma conta compatível apenas pela caixa do domínio, recusa sem escolher arbitrariamente; a Core deve manter o contrato de normalização no cadastro/login. Não adicionamos unicidade nova sobre contas existentes. Um índice não único nas duas expressões de e-mail evita varrer users a cada solicitação; o UNIQUE(email) original não cobre esse lookup.

A conta é bloqueada e o endereço/status é relido. O relógio é obtido depois do bloqueio. A janela móvel é `(agora - 15 minutos, agora]`; nova emissão exatamente após 60 segundos é permitida se houver vaga. Todas as emissões confirmadas contam, inclusive já usadas ou invalidadas. A emissão não invalida links anteriores, não altera senha e não revoga sessões.

A Core mantém a resposta pública genérica para OK, conta ausente/inativa e limite atingido; não devolve IDs internos, hash ou motivo da recusa. Falha SMTP posterior ao commit não desfaz a emissão; não há SMTP ou retry dentro do banco. A entropia e a propriedade de SHA-256 não podem ser verificadas pelo tamanho do BYTEA.

## Conclusão

`complete_password_reset(p_token_hash BYTEA, p_password_hash TEXT) RETURNS TEXT`

| Resultado | Significado interno |
|---|---|
| OK | Senha alterada, token consumido, demais tokens pendentes invalidados e sessões revogadas. |
| INVALID_INPUT | Hash de token inválido ou hash de senha nulo/vazio/maior que 255 caracteres. |
| INVALID_TOKEN | Token ausente, expirado, consumido, invalidado ou conta indisponível. |

A Core transforma rejeições em resposta pública genérica, sem revelar usuário. O hash codificado da senha é um dado confiável produzido pela Core; o banco não executa Argon2 nem consegue reconhecer toda forma de senha em texto puro.

A operação usa uma única transação: atualiza `users.password_hash`, consome o token escolhido, invalida os outros ainda pendentes (inclusive expirados), revoga sessões ainda não revogadas com `PASSWORD_RESET` e grava auditoria. Revogações anteriores preservam seu motivo. Refresh tokens não são apagados ou consumidos artificialmente: qualquer renovação é rejeitada pela sessão revogada. JWT exige a checagem de sessão pela Core já prevista no contrato.

Qualquer erro inesperado exige ROLLBACK integral. Não converter exceção de integridade/permissão em OK. Nenhuma rotina realiza COMMIT interno. Não chamar logout separado como substituição desta operação.

## Novo contrato obrigatório de login

`open_auth_session(p_user_id UUID, p_token_hash BYTEA, p_expected_password_hash TEXT)`

Mantém retorno `result_code TEXT, session_id UUID, expires_at TIMESTAMPTZ` e resultados OK, INVALID_INPUT, USER_UNAVAILABLE; acrescenta CREDENTIAL_CHANGED. A assinatura de dois argumentos foi removida na migração e não tem substituta com DEFAULT que permita contornar a conferência.

A Core deve guardar o hash exato que leu e validou com PasswordEncoder e passá-lo como terceiro argumento. Não reler o hash depois para preencher este parâmetro: isso aceitaria a credencial antiga. Sob lock de users, o banco compara o hash esperado com o vigente. Em CREDENTIAL_CHANGED, não emitir JWT/cookie ou sessão; exigir nova autenticação. Login com a nova senha funciona normalmente. Igualdade do hash fecha a corrida sem criar coluna de versão, mas não substitui a verificação da senha pela Core.

## Concorrência e transações

- Emissão: users → nova emissão. A contagem ocorre depois do lock, coordenando todas as instâncias da Core.
- Conclusão: descoberta sem lock → users → token de recuperação → demais tokens → sessões. O lock de users serializa todos os caminhos da mesma conta; só então cada rotina bloqueia seus objetos dependentes.
- Login/refresh/logout mantêm users primeiro. Se login/refresh confirmar antes, a recuperação revoga a sessão; se a recuperação confirmar antes, login antigo retorna CREDENTIAL_CHANGED e refresh retorna SESSION_REVOKED.
- Duas conclusões do mesmo token ou de tokens distintos: só uma confirma; a segunda relê o token e observa consumo/invalidação.
- Inativação usa users antes de revogar sessões. Para ADMIN, o gerenciamento já coordena admin_guard_state → users; reset só altera senha e não toma o mutex administrativo depois de users. Não cria inversão com o aceite de convites nem altera a regra do último ADMIN.
- Usar transações curtas READ COMMITTED. REPEATABLE READ/SERIALIZABLE podem retornar 40001; a Core deve tratar e repetir a unidade transacional completa quando apropriado, nunca repetir apenas parte do processo.

## Auditoria e permissões

Nova tabela `password_reset_token`: id, user_id, token_hash, issued_at, expires_at, consumed_at, invalidated_at. FK RESTRICT, hash único/32 bytes, timestamps finitos, expiração posterior à emissão e consumo/invalidação exclusivos. Trigger preserva identidade e estado terminal e bloqueia DELETE/TRUNCATE; retenção não foi inventada. Índice `(user_id, issued_at DESC)` atende FK, janela e invalidação; UNIQUE atende hash.

`password_reset_token_log` contém somente metadados, snapshots BEFORE/AFTER e contexto do evento, sem hash de token ou senha. Justifica-se como trilha de emissão/consumo/invalidação que não está representada em sessions. Usa a auditoria genérica revisada do projeto, com hash ausente fisicamente na tabela de log. `users_log` e `auth_session_log` registram senha alterada (somente nome da coluna, sem valor) e revogação. Operações públicas usam SYSTEM, sem atribuir ADMIN fictício. O contexto app.* externo é salvo e restaurado em sucesso, recusas e exceções; sem SET de parâmetros customizados na definição das funções.

`olius_auth_owner` continua NOLOGIN e passa a operar tokens e atualizar somente password_hash em users, além dos privilégios anteriores. Não é dono das tabelas. Core (`olius_api`/login `olius_core_api`) recebe somente EXECUTE nas duas operações; sem SELECT/DML no token ou log. Auditor recebe SELECT apenas no log sem segredos. Redis, BI, reader e catalog_editor não recebem acesso aos tokens nem às novas rotinas. olius_owner mantém manutenção dos objetos, não é papel da aplicação. A implantação/reaplicação rejeita overloads ou EXECUTE direto a papéis externos nas duas operações; exige revisão, sem retirar concessões de terceiros silenciosamente. As concessões canônicas ficam em access_control/01_roles.sql; a migração contém o mesmo delta necessário para a atualização atômica.

## Implantação

**Instalação nova:** sequência usual 01–08 → catálogo → access_control. Sem usuários, convites ou tokens reais criados pela entrega.

**Base existente:** usar `migrations/20261101_password_reset.sql` inteiro, com conta autorizada para os objetos/owners internos e Core em manutenção. Não usar `--single-transaction` externo: PostgreSQL exige confirmar a inclusão do ENUM antes de usar PASSWORD_RESET. O arquivo contém BEGIN/COMMIT explícitos para essa etapa, inclusive quando enviado como um único lote por um editor SQL. O rótulo é aditivo; restante (tabelas, funções, índice, grants e catálogo) está numa transação. Se falhar, ROLLBACK; o rótulo sem uso pode permanecer. Migração de aplicação única: nova execução após sucesso encontra as tabelas existentes e falha sem substituir seus dados. Não apagar tabelas para reaplicar.

Ordem: preparar versão Java compatível → interromper tráfego/escritas auth → backup → aplicar migração → publicar Core com novo login e endpoints → verificar permissões e casos funcionais → liberar tráfego. Não manter a Core antiga usando dois argumentos nem criar overload legado. Rollback de aplicação exige plano específico; não restabelecer um login que contorne a proteção.

Verificações: exatamente uma assinatura de open_auth_session (uuid,bytea,text); owners internos corretos; SECURITY DEFINER/search_path fixo; Core EXECUTE permitido e DML/logs negados; catálogo com as duas tabelas; credenciais antigas e sessões existentes preservadas na instalação. Não reexecutar scripts 01–03 sobre a base em uso.

## Evidências e limites

Regressões funcionais em `tests/password_reset_regression.sql`; nove disputas reais em `tests/password_reset_concurrency.py`; migração da referência anterior `70aa130` em `tests/password_reset_migration_regression.py`, sem SUPERUSER e comparando dados existentes e definições novas/migradas. O runner de CI inclui essas verificações e os contratos anteriores de autenticação, convites e último ADMIN. Relatórios locais ficam em coverage/, fora do Git. O resultado final da validação desta entrega está em PASSWORD_RESET_VALIDATION.md.

Nenhuma execução ocorre contra DEV/Aiven/produção. Testes PostgreSQL gerenciado não comprovam rede/SMTP, Java ou entrega de e-mail. A política de retenção, histórico de senhas e limite por IP não fazem parte desta entrega.
