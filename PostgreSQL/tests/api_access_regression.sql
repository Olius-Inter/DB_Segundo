-- PostgreSQL 16.15 descartável; executar como implantador, após roles/users.
-- Os fixtures são artificiais e todas as alterações são revertidas.
\set ON_ERROR_STOP on
BEGIN;
\ir fixtures_procedures.sql
INSERT INTO olius_test.ids(name,id) VALUES ('test_payment',olius_test.payment('INITIAL'));
GRANT USAGE ON SCHEMA olius_test TO olius_api;
GRANT SELECT ON olius_test.ids TO olius_api;
SET LOCAL SESSION AUTHORIZATION olius_core_api;

-- Bloqueios reais com a identidade de conexão da Core, não como superusuário.
SELECT olius_test.expect_error('UPDATE public.establishment SET points=123','42501');
SELECT olius_test.expect_error('UPDATE public.establishment SET is_pev=true','42501');
SELECT olius_test.expect_error('INSERT INTO public.collection DEFAULT VALUES','42501');
SELECT olius_test.expect_error('UPDATE public.collection_request SET status=''REJECTED''','42501');
SELECT olius_test.expect_error('UPDATE public.billing_charge SET amount=1','42501');
SELECT olius_test.expect_error('UPDATE public.billing_charge SET status=''PAID''','42501');
SELECT olius_test.expect_error('UPDATE public.payment SET amount=1','42501');
SELECT olius_test.expect_error('UPDATE public.payment_refund SET amount=1','42501');
SELECT olius_test.expect_error('SELECT * FROM public.auth_refresh_token','42501');
SELECT olius_test.expect_error('SELECT * FROM public.users_log','42501');
SELECT olius_test.expect_error('INSERT INTO public.users_log DEFAULT VALUES','42501');
SELECT olius_test.expect_error('CALL public.rebuild_user_points(NULL,NULL,NULL)','42501');
SELECT olius_test.expect_error('CALL public.reconcile_establishment_certificates(NULL)','42501');
SELECT olius_test.expect_error('SET ROLE olius_business_owner','42501');
SELECT olius_test.expect_error('SET ROLE olius_auth_owner','42501');
SELECT olius_test.expect_error('CREATE TABLE public.api_forbidden(id integer)','42501');

DO $$
DECLARE req uuid; req2 uuid; col uuid; delivery uuid; second uuid; app uuid; cycle uuid; refund uuid;
    t timestamptz; k uuid:=gen_random_uuid(); dtime timestamptz:=clock_timestamp(); address uuid; pev_id uuid;
BEGIN
    PERFORM set_config('app.audit_actor','USER',true);
    PERFORM set_config('app.current_user_id',olius_test.id('est')::text,true);
    CALL public.create_collection_request(olius_test.id('est'),20,'API pedido',k,req);
    CALL public.create_collection_request(olius_test.id('est'),20,'API pedido',k,req2);
    PERFORM olius_test.assert(req=req2,'API reenvio de pedido idempotente');
    PERFORM set_config('app.current_user_id',olius_test.id('admin')::text,true);
    CALL public.schedule_collection_request(req,clock_timestamp()+interval '1 hour',clock_timestamp(),olius_test.id('admin'),'Agendamento API');
    PERFORM olius_test.expect_error(format('SELECT public.reject_collection_request(%L,%L,%L)',req,olius_test.id('admin'),'não pode rejeitar aprovado'),'22023');
    PERFORM set_config('app.audit_actor','DRIVER_FORM',true);
    PERFORM set_config('app.current_user_id','',true);
    PERFORM set_config('app.operational_driver_id',olius_test.id('driver')::text,true);
    t:=public.record_collection_arrival(req,olius_test.id('driver'));
    PERFORM olius_test.assert(t=public.record_collection_arrival(req,olius_test.id('driver')),'reenvio da chegada preserva horário');
    PERFORM set_config('app.audit_actor','USER',true);
    PERFORM set_config('app.current_user_id',olius_test.id('est')::text,true);
    PERFORM set_config('app.operational_driver_id','',true);
    PERFORM public.accept_collection_service(req,olius_test.id('est'));
    PERFORM olius_test.expect_error(format('SELECT public.accept_collection_service(%L,%L)',req,olius_test.id('billing_est')),'22023');
    PERFORM set_config('app.audit_actor','DRIVER_FORM',true);
    PERFORM set_config('app.current_user_id','',true);
    PERFORM set_config('app.operational_driver_id',olius_test.id('driver')::text,true);
    CALL public.record_collection(req,olius_test.id('driver'),20,20,'ACCEPTABLE',false,ARRAY[]::text[],'API coleta',clock_timestamp(),col);
    PERFORM olius_test.assert((SELECT points>0 FROM public.establishment WHERE id=olius_test.id('est')),'coleta calcula saldo sem DML livre');
    PERFORM olius_test.assert(EXISTS(SELECT 1 FROM public.certificate WHERE establishment_id=olius_test.id('est')),'certificado emitido internamente');
    PERFORM public.calculate_collection_score(col);
    PERFORM public.get_cycle_availability(olius_test.id('cycle'));
    PERFORM public.get_certificate_progress(olius_test.id('est'));
    PERFORM set_config('app.audit_actor','USER',true);
    PERFORM set_config('app.current_user_id',olius_test.id('admin')::text,true);
    PERFORM set_config('app.operational_driver_id','',true);
    CALL public.correct_collection(col,1,olius_test.id('admin'),'RECORDED',20,20,'ACCEPTABLE',false,ARRAY[]::text[],'Correção API','Revisão autorizada');
    PERFORM olius_test.expect_error(format('CALL public.correct_collection(%L,1,%L,''RECORDED'',20,20,''ACCEPTABLE'',false,ARRAY[]::text[],NULL,''revisão obsoleta'')',col,olius_test.id('admin')),'40001');
    PERFORM set_config('app.current_user_id',olius_test.id('validator')::text,true);
    CALL public.record_pev_delivery(gen_random_uuid(),olius_test.id('citizen'),olius_test.id('pev'),olius_test.id('validator'),10,dtime,delivery);
    PERFORM set_config('app.current_user_id',olius_test.id('admin')::text,true);
    CALL public.correct_pev_delivery(delivery,1,olius_test.id('admin'),'RECORDED',5,dtime,'Correção API');
    PERFORM olius_test.assert((SELECT points=5 FROM public.citizens WHERE id=olius_test.id('citizen')),'saldo B2C reconstruído');
    CALL public.create_collection_request(olius_test.id('est'),10,'Cancelar API',gen_random_uuid(),second);
    CALL public.cancel_collection_request(second,olius_test.id('admin'),'OPERATION','Cancelamento API');
    CALL public.create_collection_request(olius_test.id('est'),10,'Rejeitar API',gen_random_uuid(),second);
    PERFORM public.reject_collection_request(second,olius_test.id('admin'),'Rejeição API');
    PERFORM olius_test.assert((SELECT status='REJECTED' FROM public.collection_request WHERE id=second),'rejeição pendente');
    PERFORM set_config('app.audit_actor','SYSTEM',true);
    PERFORM set_config('app.current_user_id','',true);
    CALL public.apply_verified_payment(olius_test.id('test_payment'),app,cycle,refund);
    PERFORM olius_test.assert(app IS NOT NULL AND cycle IS NOT NULL,'API aplica pagamento e gera ciclo');
    PERFORM olius_test.expect_error(format('SELECT public.set_billing_charge_external_status(%L,''EXPIRED'')',(SELECT billing_charge_id FROM public.payment WHERE id=olius_test.id('test_payment'))),'22023');
    PERFORM olius_test.expect_error(format('SELECT public.set_billing_charge_external_status(%L,''PAID'')',(SELECT billing_charge_id FROM public.payment WHERE id=olius_test.id('test_payment'))),'22023');

    -- Cadastro e PEV usam grants por coluna; auditoria/sincronização são internas.
    PERFORM set_config('app.audit_actor','USER',true);
    PERFORM set_config('app.current_user_id',olius_test.id('admin')::text,true);
    UPDATE public.users SET name='Nome atualizado pela API' WHERE id=olius_test.id('citizen');
    INSERT INTO public.addresses(owner_kind,state,city,neighborhood,street,number,cep)
    VALUES('PEV','SP','Cidade','Bairro','Rua','1','12345678') RETURNING id INTO address;
    INSERT INTO public.pev(establishment_id,address_id) VALUES(olius_test.id('est'),address) RETURNING id INTO pev_id;
    UPDATE public.pev SET status='APPROVED',approved_by=olius_test.id('admin'),approved_at=clock_timestamp() WHERE id=pev_id;
    PERFORM olius_test.assert((SELECT is_pev FROM public.establishment WHERE id=olius_test.id('est')),'PEV sincroniza flag sem grant à API');
    UPDATE public.certificate SET pdf_url='https://example.test/certificate.pdf' WHERE establishment_id=olius_test.id('est');

    -- A integração cria uma tentativa nova após a anterior estar encerrada.
    INSERT INTO public.billing_charge(billing_order_id,establishment_id,purpose,provider,
        plan_id,plan_name,quoted_monthly_price,quoted_volume_limit_liters,quoted_collection_limit,amount,expires_at)
    SELECT billing_order_id,establishment_id,'INITIAL','test-provider',olius_test.id('plan'),
        'Plano teste',100,10000,1000,100,clock_timestamp()+interval '1 day'
    FROM public.payment WHERE id=olius_test.id('test_payment') RETURNING id INTO second;
    PERFORM public.set_billing_charge_external_status(second,'CANCELLATION_PENDING');
    PERFORM public.set_billing_charge_external_status(second,'CANCELLED');
    PERFORM public.set_billing_charge_external_status(second,'CANCELLED');
    PERFORM olius_test.assert((SELECT status='CANCELLED' AND closed_at IS NOT NULL FROM public.billing_charge WHERE id=second),'estado externo e reenvio');
    INSERT INTO public.payment(billing_charge_id,billing_order_id,establishment_id,provider,
        provider_payment_id,amount,paid_at,verified_at)
    SELECT id,billing_order_id,establishment_id,provider,gen_random_uuid()::text,100,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM public.billing_charge WHERE id=second RETURNING id INTO second;
    CALL public.apply_verified_payment(second,app,cycle,refund);
    PERFORM olius_test.assert(refund IS NOT NULL,'pagamento duplicado gera reembolso interno');
    INSERT INTO public.payment_refund_attempt(refund_id,attempt_number) VALUES(refund,1);
    UPDATE public.payment_refund_attempt SET finished_at=clock_timestamp(),result_status='COMPLETED' WHERE refund_id=refund;
    UPDATE public.payment_refund SET status='COMPLETED',completed_at=clock_timestamp(),provider_refund_id='refund-api-test' WHERE id=refund;
    INSERT INTO public.payment_provider_event(provider,provider_event_id,event_type,provider_payment_id)
    SELECT provider,'event-api-test','payment.confirmed',provider_payment_id FROM public.payment WHERE id=second;
    UPDATE public.payment_provider_event SET payment_id=second,status='PROCESSED',attempts=1,processed_at=clock_timestamp() WHERE provider_event_id='event-api-test';

    -- Dados de login são acessíveis apenas ao backend; sessão continua por RPC.
    PERFORM password_hash FROM public.users WHERE id=olius_test.id('citizen');
    PERFORM public.open_auth_session(olius_test.id('citizen'),decode(repeat('ab',32),'hex'));
    UPDATE public.users SET status='INACTIVE' WHERE id=olius_test.id('citizen');
END $$;
RESET SESSION AUTHORIZATION;
SELECT olius_test.assert(EXISTS(SELECT 1 FROM public.users_log WHERE actor_kind='USER' AND performed_by=olius_test.id('admin')),'autoria de cadastro preservada');
SELECT olius_test.assert(EXISTS(SELECT 1 FROM public.collection_request_log WHERE audit_reason='Rejeição API'),'motivo de rejeição auditado');
SELECT olius_test.assert((SELECT count(*)=16 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner='olius_business_owner'::regrole),'16 rotinas de negócio protegidas');
SELECT olius_test.assert(EXISTS(SELECT 1 FROM public.auth_session WHERE user_id=olius_test.id('citizen') AND revocation_reason='ACCOUNT_INACTIVE'),'inativação pela Core revoga sessão');
ROLLBACK;
\echo 'PASS: contrato da Core, oito procedures, consultas, auditoria e bloqueios'
