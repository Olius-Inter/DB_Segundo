\set ON_ERROR_STOP on
-- PostgreSQL descartável, após instalação completa e access_control.
BEGIN;
\ir fixtures_procedures.sql
GRANT USAGE ON SCHEMA olius_test TO olius_api;
GRANT SELECT ON olius_test.ids TO olius_api;

-- Aprovação e rejeição cobrem os dois tipos de responsável do PEV.
INSERT INTO olius_test.ids(name) VALUES ('notification_address_citizen'), ('notification_address_est');
INSERT INTO public.addresses(id,owner_kind,state,city,neighborhood,street,number,cep)
SELECT id,'PEV','SP','Cidade teste','Centro','Rua teste','1','12345678'
FROM olius_test.ids WHERE name LIKE 'notification_address_%';
INSERT INTO public.pev(citizen_id,address_id)
VALUES (olius_test.id('citizen'),olius_test.id('notification_address_citizen'));
INSERT INTO public.pev(establishment_id,address_id)
VALUES (olius_test.id('est'),olius_test.id('notification_address_est'));
SELECT olius_test.assert((SELECT count(*)=0 FROM public.notification),'PEV pendente não gera aviso');

SET LOCAL SESSION AUTHORIZATION olius_api;
UPDATE public.pev SET status='APPROVED',approved_by=olius_test.id('admin'),approved_at=clock_timestamp()
WHERE citizen_id=olius_test.id('citizen');
UPDATE public.pev SET status='REJECTED' WHERE establishment_id=olius_test.id('est');
UPDATE public.pev SET status='INACTIVE' WHERE id=olius_test.id('pev');
UPDATE public.pev SET status='APPROVED' WHERE id=olius_test.id('pev');
UPDATE public.pev SET status=status WHERE id=olius_test.id('pev');
RESET SESSION AUTHORIZATION;

SELECT olius_test.assert((SELECT count(*)=4 FROM public.notification),'quatro transições, sem duplicação no no-op');
SELECT olius_test.assert(EXISTS(SELECT 1 FROM public.notification
    WHERE type='PEV_APPROVED' AND recipient_id=olius_test.id('citizen')
      AND resource_type='PEV' AND resource_id=(SELECT id FROM public.pev WHERE citizen_id=olius_test.id('citizen'))),
    'aprovação destinada ao cidadão responsável');
SELECT olius_test.assert(EXISTS(SELECT 1 FROM public.notification
    WHERE type='PEV_REJECTED' AND recipient_id=olius_test.id('est')),'rejeição destinada ao estabelecimento');
SELECT olius_test.assert((SELECT count(DISTINCT type)=2 AND count(DISTINCT event_id)=2
    FROM public.notification WHERE recipient_id=olius_test.id('validator')
    AND type IN ('PEV_INACTIVATED','PEV_REACTIVATED')),'transições sucessivas têm eventos distintos');
SELECT olius_test.assert((SELECT bool_and(read_at IS NULL) FROM public.notification),'avisos começam não lidos');

SAVEPOINT reverted_status;
UPDATE public.pev SET status='INACTIVE' WHERE id=olius_test.id('pev');
SELECT olius_test.assert((SELECT count(*)=5 FROM public.notification),'aviso participa da transação');
ROLLBACK TO SAVEPOINT reverted_status;
SELECT olius_test.assert((SELECT count(*)=4 FROM public.notification),'rollback remove aviso');

-- Operações B2B percorrem a rotina pública com a identidade da Core.
SET LOCAL SESSION AUTHORIZATION olius_api;
DO $test$
DECLARE request_id UUID; scheduled_at TIMESTAMPTZ := CURRENT_TIMESTAMP + INTERVAL '1 day';
BEGIN
    CALL public.create_collection_request(olius_test.id('est'),10,'Aviso B2B',gen_random_uuid(),request_id);
    CALL public.schedule_collection_request(request_id,scheduled_at,CURRENT_TIMESTAMP,olius_test.id('admin'),'Acordo inicial');
    CALL public.schedule_collection_request(request_id,scheduled_at,CURRENT_TIMESTAMP,olius_test.id('admin'),'Acordo inicial');
    CALL public.schedule_collection_request(request_id,scheduled_at+INTERVAL '1 day',CURRENT_TIMESTAMP,olius_test.id('admin'),'Novo acordo');
END $test$;
SELECT olius_test.assert((SELECT count(*)=2 FROM public.notification WHERE resource_type='COLLECTION_REQUEST'),
    'agendamento e reagendamento geram dois avisos');
SELECT olius_test.assert((SELECT count(DISTINCT n.type)=2 AND bool_and(n.recipient_id=olius_test.id('est'))
    FROM public.notification n JOIN public.collection_schedule_history h ON h.id=n.event_id
    WHERE n.resource_type='COLLECTION_REQUEST' AND n.resource_id=h.collection_request_id),
    'avisos B2B referenciam cada histórico e seu titular');

UPDATE public.notification SET read_at=clock_timestamp()
WHERE type='PEV_APPROVED' AND read_at IS NULL;
SELECT olius_test.assert((SELECT count(*)=1 FROM public.notification WHERE read_at IS NOT NULL),'Core marca leitura');
SELECT olius_test.expect_error('INSERT INTO public.notification DEFAULT VALUES','42501');
SELECT olius_test.expect_error('UPDATE public.notification SET message=message','42501');
SELECT olius_test.expect_error('DELETE FROM public.notification','42501');
SELECT olius_test.expect_error('SELECT public.notify_pev_status_change()','42501');
SELECT olius_test.expect_error('SELECT public.notify_collection_schedule_change()','42501');
RESET SESSION AUTHORIZATION;

SELECT olius_test.expect_error(
    'INSERT INTO public.notification(recipient_id,type,title,message,resource_type,resource_id,event_id)
     SELECT recipient_id,type,title,message,resource_type,resource_id,event_id FROM public.notification LIMIT 1',
    '23505');
SELECT olius_test.assert(NOT has_table_privilege('olius_reader','public.notification','SELECT')
    AND NOT has_table_privilege('olius_ranking_reader','public.notification','SELECT')
    AND NOT has_table_privilege('olius_bi_reader_role','public.notification','SELECT'),
    'leitores, ranking e BI sem acesso aos avisos');
ROLLBACK;
\echo 'PASS: notification events, recipients, rollback, deduplication and permissions'
