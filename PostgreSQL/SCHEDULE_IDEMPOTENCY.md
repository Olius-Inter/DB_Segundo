# Agendamento B2B com chave de idempotência

## Problema e contrato

Comparar somente o horário atual não reconhece reenvios atrasados: uma primeira
solicitação pode voltar depois de um reagendamento posterior e desfazer a agenda.
schedule_collection_request_once recebe uma UUID para identificar cada ação de
agendamento. A Core deve gerar a chave antes da primeira tentativa e reutilizar a
mesma chave e o mesmo payload em todo reenvio daquela ação. Uma nova ação recebe
outra chave. A chave é única por solicitação, não global entre todas as solicitações.

O wrapper valida administrador ADMIN/ACTIVE, bloqueia a solicitação com FOR UPDATE
e consulta collection_schedule_command. Reenvio conhecido retorna sem modificar
a agenda; mesma chave com horário, acordo, administrador ou motivo diferentes
produz SQLSTATE 22000. O motivo é comparado após btrim. Chave ausente produz 22023,
administrador indisponível 42501 e solicitação inexistente P0002. Erro de estado
é validado pela rotina de agendamento existente para ações ainda não processadas.

Comando novo chama schedule_collection_request e grava sua chave na mesma transação.
A chave é preservada inclusive se a ação mantém o horário atual e não gera histórico.
Rollback desfaz comando, alterações de agenda, histórico e notificações da ação.
O bloqueio da solicitação serializa também as chamadas da rotina anterior.

## Permissões e Core

A API recebe EXECUTE no wrapper, sem acesso direto à tabela de comandos. O wrapper
usa SECURITY DEFINER e nomes qualificados com search_path restrito. A Core deve
validar a identidade e a autorização do administrador antes de chamar a rotina.
O procedimento anterior permanece disponível por compatibilidade; chamadas sem
chave não obtêm a proteção contra reenvios antigos. A Core precisa usar o wrapper.
Ao atualizar o script 04, a nova rotina utiliza CREATE OR REPLACE como as demais.
Seguir o processo existente de reaplicação de permissões após atualização de rotinas.

## Isolamento e reenvio da transação

READ COMMITTED reconhece a chave após o bloqueio da solicitação. Em REPEATABLE
READ, um comando sem mudança de horário pode encontrar uma chave confirmada por
outra transação que ainda não é visível no snapshot. Somente a colisão da PK
collection_schedule_command_pkey é convertida de 23505 para 40001. Outras violações
de unicidade mantêm seu erro original; não há ON CONFLICT DO NOTHING no wrapper.

Ao receber 40001 (inclusive os emitidos naturalmente por níveis de isolamento mais
fortes), a Core deve desfazer e repetir a TRANSAÇÃO INTEIRA em nova transação,
com tentativas limitadas, mesma chave e mesmo payload. Repetir dentro do mesmo
snapshot não resolve a invisibilidade. A nova tentativa compara os campos:
igualdade retorna sem alteração e divergência continua produzindo 22000.
Não considerar 40001 como sucesso nem como confirmação de aceite do comando.
Referência: [isolamento no PostgreSQL 16](https://www.postgresql.org/docs/16/transaction-iso.html).

Instalação e migração validam a ACL do wrapper antes de conceder EXECUTE à API.
Concessões explícitas a outros destinatários, incluindo olius_reader, ou sobrecargas
não revisadas interrompem a implantação com 42501 e rollback. Revisar/remover a
concessão indevida ou o default privilege e repetir; não ignorar a falha. A checagem
não elimina permissões de terceiros silenciosamente. CREATE OR REPLACE preserva
ACLs, por isso somente revogar PUBLIC não resolve concessões explícitas anteriores.
Referência: [CREATE PROCEDURE](https://www.postgresql.org/docs/16/sql-createprocedure.html).

## Implantação

Instalação nova: seguir scripts principais, catálogo e controle de acesso na ordem
existente. A tabela fica no 01, a procedure no 04 e seus acessos no access_control.
Banco existente: instalar primeiro a entrega de notificações e então executar
migrations/20261104_schedule_idempotency.sql uma vez, com conta autorizada a SET
ROLE olius_owner. A migração é transacional, cria a estrutura e a rotina, configura
EXECUTE e documenta a tabela/seis colunas no catálogo sem carga complementar.
Não aplicar essa migração sobre instalação que já contém a tabela.

Antes da atualização, confirmar o destino e produzir backup. Não executar os testes
de regressão em banco compartilhado: os testes de migração removem objetos novos
para reconstituir a versão anterior e só podem rodar no ambiente descartável do CI.
Após atualizar o banco, implantar a Core consumidora. Notificações anteriores não
são recriadas; comandos anteriores sem chave não podem ser reconhecidos retroativamente.

## Retenção

Não há expiração nem exclusão automática de chaves. Não descartar comandos enquanto
seus reenvios ainda precisarem ser reconhecidos: apagá-los retira essa garantia.
O prazo depende de decisão de negócio. A FK existente usa ON DELETE CASCADE no
pedido; a política de exclusão foi preservada, sem criar nova permissão de DELETE.
