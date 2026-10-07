\set ON_ERROR_STOP on
-- Banco descartável com 01..05 instalados. Tudo é revertido ao terminar.
BEGIN;
\ir fixtures_procedures.sql

DO $$
DECLARE
    k UUID := gen_random_uuid(); d UUID; d2 UUID; r UUID; r2 UUID; c UUID;
    original_date TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '1 hour';
BEGIN
    CALL record_pev_delivery(k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 10, original_date, d);
    CALL record_pev_delivery(k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 10, original_date, d2);
    PERFORM olius_test.assert(d = d2, 'reenvio B2C não duplica');
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,20,%L,NULL)',
        k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), original_date), '22000');
    CALL record_pev_delivery(gen_random_uuid(), olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 3,
        original_date - INTERVAL '5 minutes', d2);
    CALL record_pev_delivery(gen_random_uuid(), olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 2, original_date, d2);
    PERFORM olius_test.assert((SELECT points = 15 FROM citizens WHERE id = olius_test.id('citizen')), 'datas anteriores e iguais aceitas');
    PERFORM olius_test.assert((SELECT balance_before = 0 AND balance_after = 10 AND revision = 1 FROM point_calculation WHERE delivery_pev_id = d AND is_current), 'entrega antiga não reordena cálculo anterior');

    CALL correct_pev_delivery(d, 1, olius_test.id('admin'), 'RECORDED', 5, original_date, 'Correção teste');
    PERFORM olius_test.assert((SELECT oil_volume_liters = 5 AND points_earned = 5 AND revision = 2 AND processing_order = 1 AND corrected_by = olius_test.id('admin') FROM delivery_pev WHERE id = d), 'UPDATE e metadados restaurados');
    PERFORM olius_test.assert((SELECT points = 10 FROM citizens WHERE id = olius_test.id('citizen')), 'saldo reconstruído');
    CALL record_pev_delivery(k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 10, original_date, d2);
    PERFORM olius_test.assert(d = d2, 'reenvio original após correção');
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,5,%L,NULL)',
        k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), original_date), '22000');
    PERFORM olius_test.expect_error(format('CALL correct_pev_delivery(%L,NULL,%L,%L,5,%L,%L)', d, olius_test.id('admin'), 'RECORDED', original_date, 'Teste'), '22023');
    PERFORM olius_test.expect_error(format('CALL correct_pev_delivery(%L,1,%L,%L,5,%L,%L)', d, olius_test.id('admin'), 'RECORDED', original_date, 'Teste'), '40001');
    PERFORM olius_test.expect_error(format('CALL correct_pev_delivery(%L,2,%L,%L,5,%L,%L)', d, olius_test.id('citizen'), 'RECORDED', original_date, 'Teste'), '42501');
    PERFORM olius_test.expect_error(format('CALL correct_pev_delivery(%L,2,%L,%L,5,%L,%L)', d, olius_test.id('admin'), 'RECORDED', original_date, ' '), '22023');
    CALL correct_pev_delivery(d, 2, olius_test.id('admin'), 'ANNULLED', NULL, NULL, 'Anulação teste');
    PERFORM olius_test.assert((SELECT points = 5 FROM citizens WHERE id = olius_test.id('citizen')), 'anulação zera efeito');
    CALL correct_pev_delivery(d, 3, olius_test.id('admin'), 'RECORDED', 5, original_date, 'Reativação teste');
    PERFORM olius_test.assert((SELECT revision = 4 AND processing_order = 1 FROM delivery_pev WHERE id = d), 'reativação preserva ordem');
    PERFORM olius_test.expect_error(format('UPDATE delivery_pev SET processing_order=0 WHERE id=%L', d), '23514');
    PERFORM olius_test.expect_error(format('UPDATE delivery_pev SET processing_order=-1 WHERE id=%L', d), '23514');
    PERFORM olius_test.expect_error(format('UPDATE delivery_pev SET processing_order=NULL WHERE id=%L', d), '23502');
    PERFORM olius_test.expect_error(format('UPDATE delivery_pev SET processing_order=1 WHERE citizen_id=%L AND processing_order=3', olius_test.id('citizen')), '23505');

    k := gen_random_uuid();
    CALL create_collection_request(olius_test.id('est'), 10, 'Pedido teste', k, r);
    CALL create_collection_request(olius_test.id('est'), 10, 'Pedido teste', k, r2);
    PERFORM olius_test.assert(r = r2, 'reenvio de pedido');
    PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,20,%L,%L,NULL)', olius_test.id('est'), 'Pedido teste', k), '22000');
    CALL schedule_collection_request(r, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP, olius_test.id('admin'), 'Acordo inicial');
    CALL create_collection_request(olius_test.id('est'), 10, 'Pedido teste', k, r2);
    PERFORM olius_test.assert(r = r2, 'pedido original após agendamento');

    r := olius_test.request();
    PERFORM olius_test.expect_error(format('CALL record_collection(%L,%L,1,10,%L,FALSE,ARRAY[NULL]::TEXT[],NULL,%L,NULL)', r, olius_test.id('driver'), 'ACCEPTABLE', original_date), '22023');
    PERFORM olius_test.expect_error(format('CALL record_collection(%L,%L,1,10,%L,FALSE,ARRAY[%L]::TEXT[],NULL,%L,NULL)', r, olius_test.id('driver'), 'ACCEPTABLE', ' ', original_date), '22023');
    PERFORM olius_test.expect_error(format('CALL record_collection(%L,%L,1,10,%L,FALSE,ARRAY[]::TEXT[],NULL,%L,NULL)', r, olius_test.id('driver'), 'ACCEPTABLE', original_date), '23514');
    CALL record_collection(r, olius_test.id('driver'), 1, 10, 'ACCEPTABLE', FALSE, ARRAY['VOLUME_OUT_OF_TOLERANCE'], NULL, original_date, c);
    PERFORM olius_test.assert((SELECT points_earned = -50 FROM collection WHERE id = c), 'penalidade nominal sem piso');
    PERFORM olius_test.assert((SELECT points = 0 FROM establishment WHERE id = olius_test.id('est')), 'piso zero do saldo');
    PERFORM olius_test.expect_error(format('CALL correct_collection(%L,1,%L,%L,1,10,%L,FALSE,ARRAY[NULL]::TEXT[],NULL,%L)', c, olius_test.id('admin'), 'RECORDED', 'ACCEPTABLE', 'Teste'), '22023');
    CALL correct_collection(c, 1, olius_test.id('admin'), 'RECORDED', 10, 10, 'ACCEPTABLE', FALSE, ARRAY[]::TEXT[], NULL, 'Correção teste');
    CALL record_collection(r, olius_test.id('driver'), 1, 10, 'ACCEPTABLE', FALSE, ARRAY['VOLUME_OUT_OF_TOLERANCE'], NULL, original_date, d);
    PERFORM olius_test.assert(d = c, 'reenvio original de coleta após correção de fatos e motivos');
    PERFORM olius_test.expect_error(format('CALL record_collection(%L,%L,10,10,%L,FALSE,ARRAY[]::TEXT[],NULL,%L,NULL)', r, olius_test.id('driver'), 'ACCEPTABLE', original_date), '22000');
    RAISE NOTICE 'PASS: B2C, revisões, idempotência, NULLs, penalidade e piso zero';
END $$;

DO $$
DECLARE r UUID; c UUID; tenth UUID; i INTEGER; score RECORD; cert UUID; code TEXT;
BEGIN
    -- O primeiro bloco deixou um sucesso B2B. Falha não reinicia recorrência.
    FOR i IN 1..119 LOOP
        r := olius_test.request();
        CALL record_collection(r, olius_test.id('driver'), 10, 10, 'ACCEPTABLE', FALSE, ARRAY[]::TEXT[], NULL,
            CURRENT_TIMESTAMP - INTERVAL '1 hour', c);
        IF i IN (9,19,99,109,119) THEN
            SELECT * INTO score FROM calculate_collection_score(c);
            PERFORM olius_test.assert(score.successful_collections_count=i+1
                AND score.recurrence_bonus_points=LEAST(i+1,100), 'marco de recorrência ' || (i+1));
        END IF;
        IF i=9 THEN
            tenth := c;
            r := olius_test.request();
            CALL record_collection(r, olius_test.id('driver'), 1, 10, 'ACCEPTABLE', FALSE,
                ARRAY['VOLUME_OUT_OF_TOLERANCE'], NULL, CURRENT_TIMESTAMP - INTERVAL '1 hour', c);
        END IF;
    END LOOP;
    PERFORM olius_test.assert((SELECT eligible_volume_liters=1201 FROM get_certificate_progress(olius_test.id('est')) LIMIT 1), 'volume ambiental inclui malsucesso');
    SELECT id, certificate_code INTO cert, code FROM certificate WHERE establishment_id=olius_test.id('est');
    CALL correct_collection(tenth, 1, olius_test.id('admin'), 'ANNULLED', NULL, NULL, NULL, NULL, ARRAY[]::TEXT[], NULL, 'Anular marco');
    PERFORM olius_test.assert((SELECT eligible_volume_liters=1191 FROM get_certificate_progress(olius_test.id('est')) LIMIT 1), 'volume ambiental ignora anulada');
    UPDATE certificate_level SET required_liters=2000 WHERE name='Nível teste';
    CALL reconcile_establishment_certificates(olius_test.id('est'));
    PERFORM olius_test.assert((SELECT status='REVOKED' FROM certificate WHERE id=cert), 'revoga certificado');
    UPDATE certificate_level SET required_liters=20 WHERE name='Nível teste';
    CALL reconcile_establishment_certificates(olius_test.id('est'));
    PERFORM olius_test.assert((SELECT status='ACTIVE' AND certificate_code=code FROM certificate WHERE id=cert), 'reativa mesmo registro/código');
    RAISE NOTICE 'PASS: recorrência 10/20/100/110/120, anulação e certificados';
END $$;

DO $$
DECLARE d UUID; k UUID := gen_random_uuid(); dt TIMESTAMPTZ := clock_timestamp() - INTERVAL '1 minute';
BEGIN
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,0.999,%L,NULL)', k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), dt), '22023');
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,%L::NUMERIC,%L,NULL)', k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 'Infinity', dt), '22023');
    CALL record_pev_delivery(k, olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), 0.70, dt, d);
    PERFORM olius_test.assert((SELECT points_earned=0 AND oil_volume_liters=0.70 FROM delivery_pev WHERE id=d), 'fração válida não ganha pontos inteiros');
    RAISE NOTICE 'PASS: precisão e volume finito';
END $$;

DO $$
DECLARE r UUID; i INTEGER; offset_time INTERVAL;
BEGIN
    -- Antes do limite gera perda; exatamente no limite e depois são atraso.
    FOR i IN 1..3 LOOP
        r := olius_test.request(10, FALSE);
        offset_time := CASE i WHEN 1 THEN INTERVAL '-1 microsecond' WHEN 2 THEN INTERVAL '0' ELSE INTERVAL '1 microsecond' END;
        UPDATE collection_request SET arrived_at = scheduled_at + INTERVAL '1 hour' + offset_time,
            arrival_recorded_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes' WHERE id = r;
        CALL cancel_collection_request(r, olius_test.id('est'), 'ESTABLISHMENT', 'Cancelamento teste');
        PERFORM olius_test.assert((SELECT cancellation_policy = CASE WHEN i=1 THEN 'LATE_FORFEITURE'::cancellation_policy_t ELSE 'FREE'::cancellation_policy_t END FROM collection_request WHERE id = r), 'fronteira de atraso ' || i);
    END LOOP;
    r := olius_test.request();
    PERFORM olius_test.expect_error(format('CALL cancel_collection_request(%L,%L,%L,%L)', r, olius_test.id('est'), 'ESTABLISHMENT', 'Teste'), '55000');
    RAISE NOTICE 'PASS: cancelamento antes/no/depois do limite e após aceite';
END $$;

DO $$
DECLARE p UUID; p2 UUID; app UUID; cycle UUID; future_cycle UUID; refund UUID; ord UUID;
BEGIN
    p := olius_test.payment('INITIAL');
    CALL apply_verified_payment(p, app, cycle, refund);
    PERFORM olius_test.assert(app IS NOT NULL AND refund IS NULL, 'pagamento inicial');
    CALL apply_verified_payment(p, app, future_cycle, refund);
    PERFORM olius_test.assert(future_cycle = cycle, 'mesmo pagamento não duplica');
    SELECT billing_order_id INTO ord FROM payment WHERE id=p;
    p2 := olius_test.payment('INITIAL', NULL, 'CANCELLED', ord);
    CALL apply_verified_payment(p2, app, future_cycle, refund);
    PERFORM olius_test.assert((SELECT reason = 'DUPLICATE_BENEFIT' FROM payment_refund WHERE id=refund), 'duplicado em cobrança cancelada reembolsa');
    p2 := olius_test.payment('INITIAL', NULL, 'EXPIRED', ord);
    CALL apply_verified_payment(p2, app, future_cycle, refund);
    PERFORM olius_test.assert((SELECT reason = 'DUPLICATE_BENEFIT' FROM payment_refund WHERE id=refund), 'duplicado em cobrança expirada reembolsa');
    p := olius_test.payment('RENEWAL', cycle);
    CALL apply_verified_payment(p, app, future_cycle, refund);
    PERFORM olius_test.assert((SELECT starts_at = (SELECT ends_at FROM subscription_cycle WHERE id=cycle) FROM subscription_cycle WHERE id=future_cycle), 'primeira antecipação mantém continuidade');
    p := olius_test.payment('RENEWAL', future_cycle);
    PERFORM olius_test.expect_error(format('CALL apply_verified_payment(%L,NULL,NULL,NULL)',p), '55000');
    -- Isola a retomada: remove sobreposição de períodos só nesta fixture.
    UPDATE subscription_cycle SET starts_at = CURRENT_TIMESTAMP - INTERVAL '60 days', ends_at = CURRENT_TIMESTAMP - INTERVAL '30 days' WHERE id=cycle;
    UPDATE subscription_cycle SET starts_at = CURRENT_TIMESTAMP - INTERVAL '30 days', ends_at = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE id=future_cycle;
    -- Reusa o mesmo pagamento/ordem que ficou pendente na rejeição anterior.
    CALL apply_verified_payment(p, app, cycle, refund);
    PERFORM olius_test.assert((SELECT starts_at > CURRENT_TIMESTAMP - INTERVAL '1 second' FROM subscription_cycle WHERE id=cycle), 'retomada sem retroatividade');
    p := olius_test.payment('UPGRADE', future_cycle, 'EXPIRED');
    CALL apply_verified_payment(p, app, cycle, refund);
    PERFORM olius_test.assert((SELECT reason = 'EXPIRED_UPGRADE' FROM payment_refund WHERE id=refund), 'upgrade expirado em cobrança expirada reembolsa');
    SELECT billing_order_id INTO ord FROM payment WHERE id=p;
    p := olius_test.payment('UPGRADE', future_cycle, 'CANCELLED', ord);
    CALL apply_verified_payment(p, app, cycle, refund);
    PERFORM olius_test.assert((SELECT reason = 'EXPIRED_UPGRADE' FROM payment_refund WHERE id=refund), 'upgrade expirado em cobrança cancelada reembolsa');
    SELECT id INTO cycle FROM subscription_cycle WHERE subscription_id=olius_test.id('billing_subscription') ORDER BY cycle_number DESC LIMIT 1;
    p := olius_test.payment('RENEWAL', cycle, 'CANCELLED');
    PERFORM olius_test.expect_error(format('CALL apply_verified_payment(%L,NULL,NULL,NULL)',p), '55000');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM payment_refund WHERE payment_id=p), 'não inventa reembolso');
    RAISE NOTICE 'PASS: inicial, reenvio, antecipação, retomada e reembolsos tardios';
END $$;

ROLLBACK;
\echo 'PASS: regressões funcionais; dados de teste revertidos'
