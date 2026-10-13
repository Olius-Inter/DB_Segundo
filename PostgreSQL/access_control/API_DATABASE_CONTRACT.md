# Contrato entre a Core API e o PostgreSQL — OLIUS

Alvo: PostgreSQL 16.15. Este contrato cobre as tabelas e rotinas atuais do MVP. A conexão da Core usa **olius_core_api**, que recebe **olius_api**. Não representa acesso de navegadores, motoristas ou cidadãos diretamente ao banco.

## Separação de responsabilidades

| Componente | Responsabilidade |
|---|---|
| Core Spring Boot | Autenticar usuários, verificar JWT/sessão, autorizar perfil e titularidade, validar formulários, proteger endpoints, verificar pagamentos no provedor, gerar documentos e publicar pontos no Redis. |
| PostgreSQL | Constraints, unicidade, referências, bloqueios concorrentes, operações atômicas, histórico, auditoria, aplicação de benefícios, reconstrução de pontos e certificados. |
| Redis | Ordenação do ranking operacional a partir dos pontos persistidos. Não substitui o PostgreSQL como fonte de verdade. |

A role técnica atende requisições de vários perfis e tem acesso a várias linhas. **Não há RLS nem uma conta PostgreSQL por usuário do aplicativo.** O backend deve filtrar consultas e validar a autorização em cada operação. IDs de administrador, estabelecimento ou validador vêm da identidade autenticada; não são aceitos como prova de autorização apenas porque aparecem no formulário.

No MVP, motorista é um cadastro operacional sem login. A Core valida os dados do motorista ativo e resolve seu ID. Isso não equivale a autenticação forte nem comprova presença física; copiar informações do motorista continua sendo uma limitação conhecida do fluxo aprovado.

## Proprietários internos

- **olius_auth_owner**: NOLOGIN; executa as funções restritas de sessões/refresh tokens.
- **olius_business_owner**: NOLOGIN; executa as operações restritas de negócio e as triggers de auditoria/sincronização de PEV. Não possui tabelas, não herda papéis e não tem CREATE ao final da instalação.
- Nenhuma conta da equipe ou da Core recebe esses papéis. A conta de implantação precisa de autoridade para transferir as rotinas a eles.

As oito procedures públicas e quatro funções operacionais usam SECURITY DEFINER com search_path fixado em pg_catalog, public, pg_temp. As duas procedures internas permanecem SECURITY INVOKER: são chamadas no contexto do proprietário interno ou por administradores que já possuem os privilégios necessários. As três funções de consulta permanecem SECURITY INVOKER.

A função genérica que escreve snapshots de auditoria **não é elevada**. Somente a função vinculada às triggers de auditoria recebe execução privilegiada; a API não pode chamá-la diretamente nem criar triggers para reutilizá-la. A trigger de PEV também executa com o proprietário interno, permitindo manter is_pev sem liberar edição dessa flag à Core.

## Consultas da Core

SELECT nas **30 tabelas de negócio** abaixo. Sessões, refresh tokens, todos os logs e as tabelas/view do catálogo não recebem SELECT direto para a Core.

O backend precisa consultar users.password_hash para conferir a senha. Esse hash nunca deve integrar respostas HTTP, logs de aplicação ou listagens de usuários. Da mesma forma, CPF, CNPJ, contatos, tokens QR e dados financeiros são consultados apenas nas jornadas autorizadas; não devolver SELECT * como resposta pública.

| Área | Tabelas consultáveis |
|---|---|
| Identidade/cadastro | users, addresses, telephone, user_qr_code, citizens, establishment, driver |
| PEV e referências | pev, establishment_type, subscription_plan, collection_failure_reason, certificate_level |
| Planos/ciclos | establishment_subscription, subscription_cycle, subscription_cycle_change |
| Financeiro | billing_order, billing_charge, payment, payment_application, payment_refund, payment_refund_attempt, payment_provider_event |
| Coletas/entregas | collection_request, collection_schedule_history, collection, collection_failure, delivery_pev |
| Pontos/certificados | point_calculation, point_transaction, certificate |

A consulta get_cycle_availability informa disponibilidade; calculate_collection_score calcula os componentes de uma coleta; get_certificate_progress consulta progresso. EXECUTE nas três é concedido à Core. Consultá-las não grava pontos nem emite certificados.

## Escrita direta autorizada

Os privilégios são por coluna. Os campos não listados permanecem bloqueados, mesmo quando outro campo da mesma tabela é editável. Omitir campos gerados, timestamps automáticos e defaults protegidos nos INSERTs. ORMs que enviem todas as colunas devem ser configurados para respeitar essa lista.

| Tabela | INSERT permitido | UPDATE permitido |
|---|---|---|
| users | id, name, email, password_hash, user_type | name, email, password_hash, status |
| addresses | id, owner_kind, state, city, neighborhood, street, number, cep, complement, latitude, longitude | state, city, neighborhood, street, number, cep, complement, latitude, longitude |
| telephone | id, telephone, user_id | telephone |
| user_qr_code | user_id, qr_token, user_type | qr_token |
| citizens | id, cpf, qr_token | cpf |
| establishment | id, cnpj, qr_token, description, type_id, address_id | cnpj, description, type_id, address_id |
| driver | id, name, cpf, cnh | name, cpf, cnh, status |
| pev | id, citizen_id, establishment_id, address_id | status, approved_at, approved_by, address_id |
| establishment_type | id, name, description | name, description |
| subscription_plan | id, name, description, monthly_price, volume_limit_liters, collection_limit | name, description, monthly_price, volume_limit_liters, collection_limit, status |
| collection_failure_reason | id, code, name, description | name, description, status |
| certificate_level | id, name, description, required_liters, badge_image_url | name, description, required_liters, badge_image_url |
| establishment_subscription | id, establishment_id | Nenhum |
| billing_order | id, establishment_id, subscription_id, purpose, benefit_key, target_cycle_id, previous_cycle_id | Nenhum |
| billing_charge | id, billing_order_id, establishment_id, purpose, target_cycle_id, provider, provider_charge_id, idempotency_key, plan_id, plan_name, plan_description, quoted_monthly_price, quoted_volume_limit_liters, quoted_collection_limit, from_plan_id, from_monthly_price, amount, currency, expires_at | provider_charge_id |
| payment | id, billing_charge_id, billing_order_id, establishment_id, provider, provider_payment_id, amount, currency, paid_at, verified_at | Nenhum |
| payment_refund | Nenhum | provider_refund_id, status, completed_at, next_attempt_at, last_error |
| payment_refund_attempt | id, refund_id, attempt_number | finished_at, provider_request_id, result_status, error_description |
| payment_provider_event | id, provider, provider_event_id, event_type, provider_payment_id | payment_id, processed_at, status, attempts, next_attempt_at, last_error |
| certificate | Nenhum | pdf_url |

DELETE existe **somente em telephone**, para excluir um contato autorizado. Os demais registros são preservados; inativação, cancelamento e anulação usam os mecanismos previstos.

A Core deve reservar manutenção de usuários ADMIN, motoristas, referências, aprovação de PEV e correções aos administradores autorizados. Não permitir que um cadastro público escolha ADMIN. Atualizar status de users dispara o tratamento de sessões já implementado. Alterar metadados de pagamento/reembolso exige confirmação do provedor, não uma solicitação comum do usuário.

Cadastro B2B/B2C: na mesma transação, criar users, endereço quando aplicável, user_qr_code e a especialização correspondente. Rotação do QR acontece em user_qr_code; as FKs propagam o token. PEV nasce PENDING; aprovação atualiza status/autor/data juntos e a trigger mantém is_pev.

Alterações de metas de certificate_level podem exigir reconciliação dos certificados existentes. O endpoint de manutenção deve prever esse tratamento administrativo; este contrato não concede a rotina interna à Core nem inventa uma política de retroatividade. Os privilégios permitem a manutenção, mas não substituem essa decisão de negócio.

## Operações de negócio pelo banco

| Rotina pública | Uso pela Core | Resultado/efeito |
|---|---|---|
| create_collection_request | Estabelecimento ativo; UUID idempotente, volume estimado e observação | Pedido PENDING, reserva validada; retorna ID |
| schedule_collection_request | ADM ativo; pedido, horário exato, agreed_at e motivo | Aprovação/agendamento e histórico |
| cancel_collection_request | Titular ou ADM, iniciativa e motivo | Cancelamento com regra de 4h, tolerância de 1h e perda quando aplicável |
| record_collection | Motorista ativo, pedido, volumes, condição, ocorrência, motivos, observação e data | Coleta, falhas, pontos e certificados na mesma transação; retorna ID |
| record_pev_delivery | Responsável ativo do PEV aprovado; cidadão, volume aceito, data, UUID | Entrega, cálculos e saldo na mesma transação; retorna ID |
| correct_collection | ADM ativo, expected_revision, dados revisados, motivo | Nova revisão e reconstrução de pontos/certificados |
| correct_pev_delivery | ADM ativo, expected_revision, dados revisados, motivo | Revisão de entrega e reconstrução do saldo |
| apply_verified_payment | Integração confiável; payment já confirmado e persistido | Aplicação/ciclo ou reembolso aprovado; retorna IDs |

As duas rotinas internas **rebuild_user_points** e **reconcile_establishment_certificates** não recebem EXECUTE para olius_api. São chamadas pelas operações acima; olius_owner pode executá-las para manutenção administrativa.

### Entradas operacionais complementares

Estas quatro funções foram acrescentadas para fechar operações já presentes nas tabelas sem liberar UPDATE genérico de status:

| Function | Parâmetros | Retorno e regra |
|---|---|---|
| record_collection_arrival | p_request_id uuid, p_driver_id uuid | timestamptz; exige motorista ativo e pedido aprovado/agendado, registra horários do servidor; repetição pelo mesmo motorista preserva a primeira chegada |
| accept_collection_service | p_request_id uuid, p_establishment_id uuid | timestamptz; exige titular ativo, pedido aprovado e chegada; registra aceite com horário do servidor, preservado no reenvio |
| reject_collection_request | p_request_id uuid, p_admin_id uuid, p_reason text | void; ADM ativo, somente PENDING sem atendimento; motivo obrigatório na auditoria; aprovado usa cancelamento operacional |
| set_billing_charge_external_status | p_charge_id uuid, p_status charge_status_t | void; sincroniza CANCELLATION_PENDING, CANCELLED ou EXPIRED a partir de OPEN/CANCELLATION_PENDING; não permite PAID nem sobrescrever estado encerrado |

Essas funções bloqueiam a linha durante a operação. Não permitem escolher retroativamente o horário de chegada/aceite. A API somente registra chegada após validar o motorista e identificar o pedido, não por uma abertura anônima da URL do QR. Chegada antes do horário é permitida: não foi criada uma janela adicional.

Uma segunda rejeição retorna erro porque o pedido já não está PENDING. A API pode consultar o estado para tratar reenvio; não houve alteração de esquema para armazenar uma chave dessa operação.

## Autenticação

EXECUTE nas cinco funções: open_auth_session, rotate_auth_refresh_token, revoke_auth_session, revoke_user_auth_sessions e get_auth_session_status. Sem SELECT/DML direto em auth_session, auth_refresh_token ou auth_session_log; sem EXECUTE nas funções auxiliares/trigger.

A Core confere a senha, gera o refresh token seguro, transmite somente o hash SHA-256 esperado pelo banco e emite JWT com sub/sid. As rotinas validam sessão/renovação/revogação. A segunda API consulta a Core para autenticação e usa uma identidade PostgreSQL distinta, caso necessite banco. Não compartilhar a credencial olius_core_api.

Reutilização de refresh token pode provocar revogação registrada pela função. Quando o resultado indicar esse caso, confirmar a transação para preservar a revogação antes de retornar a falha ao cliente; não fazer rollback automático de todo resultado de autenticação negado.

## Transações, auditoria e concorrência

1. Iniciar transação na Core para cada operação consistente. As procedures não confirmam parcialmente a transação.
2. Definir o contexto de auditoria **local à transação**, antes da escrita: app.audit_actor, app.current_user_id, app.operational_driver_id, app.audit_reason. Definir também os campos vazios que não se aplicam para impedir reutilização de contexto da conexão.
3. USER usa a identidade autenticada; DRIVER_FORM usa o motorista resolvido pela Core e nenhum performed_by; SYSTEM usa tarefas reais do backend e nenhum usuário como autor.
4. Executar consultas/DML autorizados ou a rotina pública, verificar o resultado e confirmar. Em erro SQL, reverter a transação e só reenviar quando adequado.

O banco não verifica JWT nem descobre quem fez a requisição HTTP. O contexto é fornecido pelo backend confiável, não pelo formulário. Ele documenta autoria; não é uma credencial de autorização. A função de rejeição preserva seu motivo durante a escrita e restaura o contexto anterior.

Procedures com OUT retornam uma linha de IDs para leitura pelo driver JDBC; os argumentos OUT devem ser tratados conforme a assinatura real do PostgreSQL. Functions de consulta usam SELECT; procedures usam CALL. Não realizar chamadas HTTP ao provedor segurando bloqueios de uma transação de negócio.

- Pedido: reutilizar a mesma UUID e os dados originais nos reenvios.
- Entrega: reutilizar a UUID e o payload original, mesmo após correção administrativa.
- Coleta: identidade única do pedido; reenvio deve coincidir com o registro original.
- Correções: enviar expected_revision lida anteriormente; conflito 40001 exige releitura/revisão, não substituir pela versão atual silenciosamente.
- Financeiro: reutilizar benefit_key, idempotency_key e identidades externas; chaves únicas impedem duplicação, mas a integração deve resolver conflitos e não gerar outra chave a cada timeout.
- Filas financeiras: concorrentes precisam reivindicar eventos/tentativas em transação; para FOR UPDATE nessas tabelas a Core já possui UPDATE nas colunas autorizadas. Reutilizar a chave do reembolso no provedor, sem registrar outra solicitação integral.

SQLSTATE relevantes das rotinas existentes: 22023 (parâmetro), 22000 (payload idempotente conflitante), 42501 (autorização), 55000 (estado), P0002 (registro inexistente), 40001 (revisão concorrente), 23503/23505/23514 (integridade). As quatro funções complementares usam 22023 para entrada/estado incompatível. Mapear por operação; não expor mensagens internas completas ao cliente.

## Fluxos completos

**B2B:** consultar identidade/plano/ciclo → create_collection_request → schedule_collection_request → validar motorista/QR na Core → record_collection_arrival → aceite pelo estabelecimento autenticado → accept_collection_service → record_collection → pontos/certificados internos → consultar saldos → publicar Redis. Cancelamento e rejeição usam entradas próprias.

**B2C:** responsável autenticado de PEV aprovado lê QR → Core resolve cidadão/validador e valida autorização → record_pev_delivery com UUID → entrega e pontos internos → consultar saldo → publicar Redis. Não registrar entrega sem volume aceito positivo.

**Pagamento:** Core cria assinatura pendente/ordem/cobrança com cotação congelada → integra provedor → verifica confirmação externa → insere payment e chama apply_verified_payment na mesma transação → ciclo/upgrade/aplicação ou reembolso → tarefas externas atualizam tentativas e resultado confirmado. A confirmação do provedor não é feita pela procedure.

**Correção:** ADM autentica, consulta revisão, informa motivo → procedure de correção → revisão/cálculos/certificados atualizados atomicamente → Core atualiza projeções no Redis. O envio ao Redis acontece após commit; prever reprocessamento caso falhe.

## Limites e implantação

Este contrato fecha as concessões dos objetos atuais; não implementa endpoints Spring Boot, a integração de um provedor ainda não escolhido, uma segunda API ou políticas de negócio ausentes. Não introduz tabelas nem altera o cálculo existente de pontos. Aprovação de perfis e titularidade continuam na Core.

Executar os scripts principais 01–05, catálogo 01–05, access_control/01_roles.sql e 02_users.sql. Novas funções operacionais pertencem ao script principal 04; ownership, SECURITY DEFINER e concessões pertencem exclusivamente a access_control/01_roles.sql. Reaplicar 04 ou 05 exige reaplicar 01_roles antes de liberar tráfego, pois as definições podem restaurar atributos de segurança. Implantar essa sequência sem janela de exposição às rotinas; conferir ACLs ao final.

Contas novas continuam sem senha; provisionar credenciais fora do Git. As roles são globais ao servidor, as concessões deste contrato são no banco selecionado. A separação de proprietário é uma defesa para contas operacionais; os administradores confiáveis donos das tabelas mantêm poderes de manutenção.

A instalação recusa CREATE no schema public para outro papel não revisado e EXECUTE externo em rotinas que receberão privilégios elevados. Conferir essas concessões antes da implantação; o script não apaga direitos de terceiros automaticamente. A conta de implantação pode precisar de membership nos proprietários internos para administrar as rotinas; isso não autoriza atribuí-los às contas operacionais.

Validação: instalação, reaplicação e regressões em PostgreSQL 16.15 descartável; teste da identidade olius_core_api com oito procedures, consultas, entradas operacionais e negações de acesso. Não há implantação automática no Aiven nem mudança no CI.
