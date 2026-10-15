-- Testa contratos de atendimento/cobrança; permissões reais ficam no teste da API.
\set ON_ERROR_STOP on
BEGIN;
\ir fixtures_procedures.sql
DO $$
DECLARE r UUID; pending UUID; t TIMESTAMPTZ; accepted TIMESTAMPTZ; payment_id UUID; charge UUID;
BEGIN
    CALL create_collection_request(olius_test.id('est'),10,NULL,gen_random_uuid(),r);
    PERFORM olius_test.expect_error(format('SELECT record_collection_arrival(%L,%L)',r,olius_test.id('driver')),'22023');
    CALL schedule_collection_request(r,clock_timestamp()+INTERVAL '1 hour',clock_timestamp(),olius_test.id('admin'),'Agendamento de teste');
    t:=record_collection_arrival(r,olius_test.id('driver'));
    PERFORM olius_test.assert(t IS NOT NULL AND record_collection_arrival(r,olius_test.id('driver'))=t,'arrival replay preserves timestamp');
    PERFORM olius_test.assert((SELECT arrived_at=arrival_recorded_at AND arrival_driver_id=olius_test.id('driver') FROM collection_request WHERE id=r),'arrival server data');
    PERFORM olius_test.expect_error(format('SELECT accept_collection_service(%L,%L)',r,olius_test.id('billing_est')),'22023');
    accepted:=accept_collection_service(r,olius_test.id('est'));
    PERFORM olius_test.assert(accepted IS NOT NULL AND accept_collection_service(r,olius_test.id('est'))=accepted,'acceptance replay preserves timestamp');
    PERFORM olius_test.assert((SELECT service_accepted_by=olius_test.id('est') AND service_accepted_at=service_acceptance_recorded_at FROM collection_request WHERE id=r),'acceptance owner');
    PERFORM olius_test.expect_error(format('SELECT record_collection_arrival(%L,%L)',gen_random_uuid(),olius_test.id('driver')),'22023');
    PERFORM olius_test.expect_error(format('SELECT record_collection_arrival(%L,%L)',r,gen_random_uuid()),'22023');
    PERFORM olius_test.expect_error(format('SELECT accept_collection_service(%L,%L)',r,olius_test.id('citizen')),'22023');
    PERFORM olius_test.expect_error(format('SELECT accept_collection_service(%L,%L)',gen_random_uuid(),olius_test.id('est')),'22023');
    CALL create_collection_request(olius_test.id('est'),10,NULL,gen_random_uuid(),pending);
    PERFORM olius_test.expect_error(format('SELECT accept_collection_service(%L,%L)',pending,olius_test.id('est')),'22023');
    PERFORM olius_test.expect_error(format('SELECT reject_collection_request(%L,%L,%L)',pending,olius_test.id('admin'),' '),'22023');
    PERFORM olius_test.expect_error(format('SELECT reject_collection_request(%L,%L,%L)',pending,olius_test.id('citizen'),'Teste'),'22023');
    PERFORM olius_test.expect_error(format('SELECT reject_collection_request(%L,%L,%L)',gen_random_uuid(),olius_test.id('admin'),'Teste'),'22023');
    PERFORM olius_test.expect_error(format('SELECT reject_collection_request(%L,%L,%L)',r,olius_test.id('admin'),'Teste'),'22023');
    PERFORM set_config('app.audit_actor','USER',true);
    PERFORM set_config('app.current_user_id',olius_test.id('admin')::text,true);
    PERFORM set_config('app.audit_reason','Contexto anterior',true);
    PERFORM reject_collection_request(pending,olius_test.id('admin'),'Motivo de rejeição teste');
    PERFORM olius_test.assert((SELECT status='REJECTED' FROM collection_request WHERE id=pending),'only pending rejected');
    PERFORM olius_test.assert(EXISTS(SELECT 1 FROM collection_request_log WHERE id=pending AND snapshot_kind='AFTER' AND status='REJECTED' AND audit_reason='Motivo de rejeição teste'),'rejection reason audited');
    PERFORM olius_test.assert(current_setting('app.audit_reason')='Contexto anterior','previous audit reason restored');
    PERFORM set_config('app.audit_actor','SYSTEM',true);
    PERFORM set_config('app.current_user_id','',true);
    payment_id:=olius_test.payment('INITIAL');
    SELECT billing_charge_id INTO charge FROM payment WHERE id=payment_id;
    PERFORM olius_test.expect_error(format('SELECT set_billing_charge_external_status(%L,%L)',charge,'PAID'),'22023');
    PERFORM olius_test.expect_error(format('SELECT set_billing_charge_external_status(%L,NULL)',charge),'22023');
    PERFORM olius_test.expect_error(format('SELECT set_billing_charge_external_status(%L,%L)',gen_random_uuid(),'EXPIRED'),'22023');
    PERFORM set_billing_charge_external_status(charge,'CANCELLATION_PENDING');
    PERFORM olius_test.assert((SELECT status='CANCELLATION_PENDING' AND closed_at IS NULL FROM billing_charge WHERE id=charge),'pending remains open');
    PERFORM set_billing_charge_external_status(charge,'CANCELLED');
    SELECT closed_at INTO t FROM billing_charge WHERE id=charge;
    PERFORM set_billing_charge_external_status(charge,'CANCELLED');
    PERFORM olius_test.assert((SELECT status='CANCELLED' AND closed_at=t FROM billing_charge WHERE id=charge),'cancel replay preserves closure');
    PERFORM olius_test.expect_error(format('SELECT set_billing_charge_external_status(%L,%L)',charge,'EXPIRED'),'22023');
END $$;
ROLLBACK;
\echo 'PASS: arrival, acceptance, pending rejection and external charge state'
