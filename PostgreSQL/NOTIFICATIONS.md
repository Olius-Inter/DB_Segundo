# Central persistente de notificações

Registra mudanças aprovadas de PEV (aprovação, rejeição, inativação e reativação)
e agendamento/reagendamento B2B. O aviso participa da transação da operação de
origem; rollback também desfaz o aviso. Não envia e-mail nem push externo.

## Instalação nova

Executar os scripts principais na ordem existente: 01_structure.sql,
02_check_constraints.sql, 03_indexes.sql, 04_functions_procedures.sql,
05_triggers.sql e demais scripts principais, seguidos pelo catálogo e controle
de acesso conforme os respectivos READMEs. O CHECK ck_notification_type fica
no script 02. Não aplicar a migração de notificações após uma instalação que já
contém a tabela; ela é destinada exclusivamente a uma base anterior.

## Atualização de banco existente

Antes da Core que usa a central, conferir o destino, produzir backup e aplicar
migrations/20261104_notifications.sql uma única vez. Requer a instalação anterior
do catálogo e de access_control, com autoridade para SET ROLE olius_owner.
Não executar todos os scripts de criação em uma base com dados.

A migração cria tabela, CHECK, índices, funções e triggers, concede SELECT e
UPDATE(read_at) à olius_api e documenta tabela e dez colunas no catálogo, dentro
da mesma transação. Não é necessário executar data_catalog/04_load.sql para
completar seus metadados. Não altera registros operacionais nem gera avisos
retroativos. Erro deve impedir o COMMIT; executar ROLLBACK antes de diagnosticar
ou repetir. Não ignorar erros de objetos já existentes.

A regressão notifications_migration_regression.sql é exclusiva do banco vazio e
descartável do CI: ela remove os objetos/metadados da central para simular uma
base anterior. Nunca executar esse teste em desenvolvimento compartilhado ou
produção. Compara funções, permissões, CHECK e catálogo com instalação limpa.

## Responsabilidades da Core

A conta técnica lê notification e atualiza somente read_at. Inserção é das
triggers; não há DELETE nem alteração de mensagens pela API. Toda consulta ou
marcação deve filtrar recipient_id pela identidade autenticada, inclusive por ID
individual. Marcar leitura somente quando read_at IS NULL, preservando a primeira
leitura. Esse comportamento pertence à Core, não é imposto por uma trigger.
O vínculo resource_type/resource_id é lógico; revalidar autorização ao abrir o
recurso. Não tratar o UUID de uma notificação como autorização de acesso.

## Exclusão e retenção

O comportamento existente foi preservado: excluir fisicamente users remove seus
avisos por ON DELETE CASCADE. Inativar o usuário não os exclui. A aplicação já
adota inativação para preservar histórico; não foi criada autorização nova para
excluir usuários. A política de exclusão e o prazo de retenção dos avisos ainda
precisam de decisão explícita da equipe. Não há expurgo automático nesta entrega.
