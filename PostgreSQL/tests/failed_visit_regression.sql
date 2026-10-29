-- Apenas banco descartável; inclui fatos e auditoria, revertidos ao final.
\set ON_ERROR_STOP on
BEGIN;
\ir fixtures_procedures.sql
INSERT INTO collection_failure_reason(code,name) VALUES
('ESTABLISHMENT_CLOSED','Estabelecimento fechado'),('NO_RESPONSIBLE_AVAILABLE','Responsável indisponível');
DO $$
DECLARE r UUID; c UUID; c2 UUID; normal UUID; actor_id UUID; reason TEXT;
BEGIN
    PERFORM set_config('app.audit_actor','SYSTEM',true);
    PERFORM set_config('app.audit_reason','contexto anterior',true);
    FOREACH reason IN ARRAY ARRAY['ESTABLISHMENT_CLOSED','NO_RESPONSIBLE_AVAILABLE'] LOOP
        r:=olius_test.request(10,FALSE);
        c:=record_failed_collection_visit(r,olius_test.id('admin'),reason,'Confirmado pelo ADMIN');
        c2:=record_failed_collection_visit(r,olius_test.id('admin'),reason,'Confirmado pelo ADMIN');
        PERFORM olius_test.assert(c=c2,'reenvio equivalente devolve mesmo ID');
        PERFORM olius_test.assert((SELECT result='UNSUCCESSFUL' AND points_earned=-50
            AND collected_volume_liters=0 AND presented_volume_liters=0 AND oil_condition='NOT_ASSESSED'
            AND driver_id=olius_test.id('driver') AND revision=1 FROM collection WHERE id=c),'fato sem volume/avaliação fictícios');
        PERFORM olius_test.assert((SELECT service_accepted_at IS NULL AND service_accepted_by IS NULL
            AND arrived_at=(SELECT collection_date FROM collection WHERE id=c)
            FROM collection_request WHERE id=r),'chegada preservada e sem aceite');
        PERFORM olius_test.assert((SELECT count(*)=1 FROM collection_log WHERE id=c AND operation='INSERT'
            AND actor_kind='USER' AND performed_by=olius_test.id('admin')
            AND operational_driver_id IS NULL AND audit_reason='Confirmado pelo ADMIN'),'autoria ADMIN no log original');
        PERFORM olius_test.assert((SELECT count(*)=1 FROM point_calculation WHERE collection_id=c AND is_current),'um cálculo vigente');
        PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,%L,%L)',r,olius_test.id('admin'),reason,'Alterado'),'22000');
        PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,%L,%L)',r,olius_test.id('admin'),
            CASE reason WHEN 'ESTABLISHMENT_CLOSED' THEN 'NO_RESPONSIBLE_AVAILABLE' ELSE 'ESTABLISHMENT_CLOSED' END,'Confirmado pelo ADMIN'),'22000');
        PERFORM olius_test.expect_error(format('CALL correct_collection(%L,1,%L,''RECORDED'',10,10,''ACCEPTABLE'',false,ARRAY[]::text[],''novo'',''correção'')',c,olius_test.id('admin')),'23514');
        CALL correct_collection(c,1,olius_test.id('admin'),'RECORDED',0,0,'NOT_ASSESSED',FALSE,ARRAY[reason],
            'Texto corrigido','Correção auditada');
        PERFORM olius_test.assert(record_failed_collection_visit(r,olius_test.id('admin'),reason,'Confirmado pelo ADMIN')=c,
            'reenvio consulta original após correção');
    END LOOP;
    PERFORM olius_test.assert((SELECT points=0 FROM establishment WHERE id=olius_test.id('est')),'piso zero');
    PERFORM olius_test.assert((SELECT consumed_collection_slots=2 AND consumed_volume_liters=0
        AND reserved_collection_slots=0 FROM get_cycle_availability(olius_test.id('cycle'))),'consome duas vagas, libera litros reservados');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM certificate),'sem certificado por óleo inexistente');
    PERFORM olius_test.assert(current_setting('app.audit_actor')='SYSTEM'
        AND current_setting('app.audit_reason')='contexto anterior','contexto restaurado em sucesso/reenvio/erro');
    r:=olius_test.request(10,FALSE);
    FOREACH actor_id IN ARRAY ARRAY[olius_test.id('citizen'),gen_random_uuid()] LOOP
        PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste'')',r,actor_id),'42501');
    END LOOP;
    INSERT INTO users(name,email,password_hash,user_type) VALUES('Outro ADMIN','outro-admin@olius.test','hash-teste','ADMIN');
    UPDATE users SET status='INACTIVE' WHERE id=olius_test.id('admin');
    PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste'')',r,olius_test.id('admin')),'42501');
    UPDATE users SET status='ACTIVE' WHERE id=olius_test.id('admin');
    FOREACH reason IN ARRAY ARRAY['',' ','OIL_UNACCEPTABLE'] LOOP
        PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,%L,''Teste'')',r,olius_test.id('admin'),reason),'22023');
    END LOOP;
    PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,NULL,''Teste'')',r,olius_test.id('admin')),'22023');
    FOREACH reason IN ARRAY ARRAY['',' ',NULL]::TEXT[] LOOP
        PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',%L)',r,olius_test.id('admin'),reason),'22023');
    END LOOP;
    UPDATE collection_request SET arrived_at=NULL,arrival_recorded_at=NULL,arrival_driver_id=NULL WHERE id=r;
    PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste'')',r,olius_test.id('admin')),'22023');
    r:=olius_test.request(10,FALSE);
    UPDATE collection_request SET status='REJECTED' WHERE id=r;
    PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste'')',r,olius_test.id('admin')),'55000');
    r:=olius_test.request();
    PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste'')',r,olius_test.id('admin')),'55000');
    CALL record_collection(r,olius_test.id('driver'),10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,clock_timestamp(),normal);
    PERFORM olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste'')',r,olius_test.id('admin')),'22000');
    PERFORM olius_test.assert((SELECT points=60 FROM establishment WHERE id=olius_test.id('est')),'sucesso normal preservado');
    PERFORM olius_test.assert(NOT EXISTS(SELECT collection_request_id FROM collection GROUP BY collection_request_id HAVING count(*)>1),'sem duplicação');
END $$;
-- Uma falha na projeção reverte fato, associações e logs juntos.
SELECT olius_test.request(10,FALSE) AS atomic_req \gset
CREATE FUNCTION pg_temp.fail_points() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'falha de teste na projeção' USING ERRCODE='P0001'; END $$;
CREATE TRIGGER test_fail_points BEFORE INSERT ON public.point_calculation
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_points();
SELECT olius_test.expect_error(format('SELECT record_failed_collection_visit(%L,%L,''ESTABLISHMENT_CLOSED'',''Teste atômico'')',
    :'atomic_req',olius_test.id('admin')),'P0001');
SELECT olius_test.assert(NOT EXISTS(SELECT 1 FROM collection WHERE collection_request_id=:'atomic_req')
    AND NOT EXISTS(SELECT 1 FROM collection_log WHERE collection_request_id=:'atomic_req'),'rollback integral do resultado');
DROP TRIGGER test_fail_points ON public.point_calculation;
-- Exercita a identidade real da API: EXECUTE público, núcleo e DML bloqueados.
GRANT USAGE ON SCHEMA olius_test TO olius_api;
GRANT SELECT ON olius_test.ids TO olius_api;
SELECT olius_test.request(10,FALSE) AS req \gset
SELECT olius_test.id('admin') AS admin \gset
SET LOCAL SESSION AUTHORIZATION olius_core_api;
SELECT public.record_failed_collection_visit(:'req',:'admin','ESTABLISHMENT_CLOSED','Teste conta Core');
SELECT olius_test.expect_error('CALL public.record_collection_internal(NULL,NULL,0,0,''NOT_ASSESSED'',FALSE,ARRAY[]::TEXT[],NULL,now(),NULL,NULL)','42501');
SELECT olius_test.expect_error('UPDATE public.collection SET points_earned=0','42501');
RESET SESSION AUTHORIZATION;
ROLLBACK;
\echo 'PASS: visita administrativa, autoria, idempotência, pontos, franquia e permissões'
