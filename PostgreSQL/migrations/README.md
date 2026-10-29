# Migração da Sprint 9

## Sprint 9 — visita B2B sem atendimento

Entrada: `record_failed_collection_visit(p_request_id UUID, p_admin_id UUID,
p_reason_code TEXT, p_justification TEXT) RETURNS UUID`.

A Core autentica o ADMIN e obtém seu ID do contexto autenticado, nunca de um
campo livre do formulário. Banco revalida existência, tipo ADMIN e status ACTIVE.
`olius_api` recebe apenas EXECUTE; `olius_core_api` herda esse papel. Nenhum DML
operacional ou acesso aos logs é liberado. O núcleo `record_collection_internal`
é privado, SECURITY INVOKER e só seu proprietário interno pode executá-lo.

Motivo exclusivo: `ESTABLISHMENT_CLOSED` ou `NO_RESPONSIBLE_AVAILABLE`.
Justificativa é obrigatória e normalizada por btrim. Não cobre recusa explícita
do aceite. Comunicação motorista/ADMIN é externa. Havendo aceite, usar a rotina
normal; óleo inadequado e volume fora da faixa mantêm o fluxo atual.

O pedido deve estar APPROVED, agendado, com chegada de motorista ainda ativo,
sem aceite e sem outra coleta. Não há confirmação fictícia. A rotina usa o
motorista e o instante da chegada já registrados. `collection_date=arrived_at`;
`collection.created_at` e `collection_log.performed_at` registram o lançamento.
Ambos os volumes são zero, condição NOT_ASSESSED, resultado UNSUCCESSFUL,
sem ocorrência de avaliação inventada. Um único motivo estruturado é gravado.

Retorna o UUID da coleta, também em reenvio equivalente; não há códigos adicionais
de sucesso. Solicitação é a chave de idempotência. Reenvio compara o retrato
original, motivo, ADMIN e justificativa; correções posteriores não reescrevem
esse contrato. Os quatro parâmetros devem ser reutilizados em retries.

SQLSTATEs: 22023 parâmetro ausente/inválido ou chegada incompleta; P0002 pedido
inexistente; 42501 ADMIN ou motorista inexistente/inativo, ou EXECUTE negado;
55000 estado incompatível, aceite presente ou histórico original indisponível;
22000 conflito com registro original; 23503 motivo inexistente/inativo.
Timeout/deadlock/serialização: tratar pelos SQLSTATEs PostgreSQL, abortar e
repetir a transação inteira com os mesmos parâmetros quando apropriado.

Não enviar um horário livre nem um ID alternativo de motorista. A rotina define
temporariamente app.audit_actor=USER, app.current_user_id=ADMIN,
app.operational_driver_id vazio e app.audit_reason=justificativa; restaura os
quatro contextos em sucesso, reenvio e erro. Não usar SET app.* na definição da
função: isso impediria implantação no Aiven. Auditoria original guarda o ADMIN;
collection.driver_id e request.arrival_driver_id preservam o responsável físico.

Uma única transação: bloqueio compartilhado de ADMIN/motorista, estabelecimento
FOR UPDATE, pedido FOR UPDATE, evento/cálculos. Reutiliza as mesmas rotinas de
pontos e certificados: -50 nominais uma vez, piso zero, sem bônus/volume fictício.
Pela disponibilidade oficial, consome uma vaga e zero litros e libera a reserva
original. O pedido conserva APPROVED como no registro normal: existência da coleta
encerra a reserva. Não converter em cancelamento nem editar saldos pela API.
Correções continuam em correct_collection com revisão e justificativa; sem aceite
devem manter ausência de atendimento/volume ou anular pelo fluxo existente.

Base nova: scripts atuais, catálogo, access_control e initial_data. Base instalada:
executar somente a migração `migrations/20261029_failed_collection_visit.sql`,
inteira e fora de transação existente, como implantador. A migração conserva
dados, IDs e segurança, é reaplicável e inclui consultas de conferência. Não
reexecutar 01–03. Revisar relatórios de retorno antes de liberar a Core.
