\set ON_ERROR_STOP on
-- Somente banco descartável. A ausência de erro ou outro SQLSTATE reprova o teste.
BEGIN;
\ir fixtures_procedures.sql

-- Reconstrução: identidade, autorização e justificativa.
DO $$
BEGIN
    PERFORM olius_test.expect_error(format('CALL rebuild_user_points(%L)', gen_random_uuid()), 'P0002');
    PERFORM olius_test.expect_error(format('CALL rebuild_user_points(%L,%L,NULL)',
        olius_test.id('est'), olius_test.id('admin')), '22023');
    PERFORM olius_test.expect_error(format('CALL rebuild_user_points(%L,NULL,%L)',
        olius_test.id('est'), 'Teste negativo'), '22023');
    PERFORM olius_test.expect_error(format('CALL rebuild_user_points(%L,%L,%L)',
        olius_test.id('est'), olius_test.id('citizen'), 'Teste negativo'), '42501');
    PERFORM olius_test.expect_error(format('CALL reconcile_establishment_certificates(%L)', gen_random_uuid()), 'P0002');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM point_calculation), 'reconstruções rejeitadas não criam cálculos');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM certificate), 'conciliação rejeitada não concede certificados');
    RAISE NOTICE 'PASS: reconstrução e certificados rejeitam parâmetros e identidades inválidos';
END $$;

-- B2B: chave, identidade, volume, observação, assinatura e limite disponível.
DO $$
DECLARE bad_volume TEXT;
BEGIN
    PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,10,NULL,NULL,NULL)', olius_test.id('est')), '22023');
    PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,10,NULL,%L,NULL)', gen_random_uuid(), gen_random_uuid()), '42501');
    FOREACH bad_volume IN ARRAY ARRAY['0', '-1', 'NaN', 'Infinity', '-Infinity', '1.001'] LOOP
        PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,%L::NUMERIC,NULL,%L,NULL)',
            olius_test.id('est'), bad_volume, gen_random_uuid()), '22023');
    END LOOP;
    PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,10,%L,%L,NULL)',
        olius_test.id('est'), ' ', gen_random_uuid()), '22023');
    PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,10,NULL,%L,NULL)',
        olius_test.id('billing_est'), gen_random_uuid()), '55000');
    PERFORM olius_test.expect_error(format('CALL create_collection_request(%L,10001,NULL,%L,NULL)',
        olius_test.id('est'), gen_random_uuid()), '23514');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM collection_request), 'pedidos rejeitados não reservam volume/vaga');
    RAISE NOTICE 'PASS: solicitações B2B inválidas não são persistidas';
END $$;

-- Agendamento e correção: inexistência, falta de autorização e dados obrigatórios.
DO $$
DECLARE missing UUID := gen_random_uuid(); dt TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '1 hour';
BEGIN
    PERFORM olius_test.expect_error(format('CALL schedule_collection_request(%L,NULL,%L,%L,%L)',
        missing, dt, olius_test.id('admin'), 'Teste negativo'), '22023');
    PERFORM olius_test.expect_error(format('CALL schedule_collection_request(%L,%L,%L,%L,%L)',
        missing, dt, dt, olius_test.id('citizen'), 'Teste negativo'), '42501');
    PERFORM olius_test.expect_error(format('CALL schedule_collection_request(%L,%L,%L,%L,%L)',
        missing, dt, dt, olius_test.id('admin'), 'Teste negativo'), 'P0002');
    PERFORM olius_test.expect_error(format('CALL correct_collection(%L,1,%L,%L,10,10,%L,FALSE,ARRAY[]::TEXT[],NULL,%L)',
        missing, olius_test.id('admin'), 'RECORDED', 'ACCEPTABLE', 'Teste negativo'), 'P0002');
    PERFORM olius_test.expect_error(format('CALL correct_pev_delivery(%L,1,%L,%L,10,%L,%L)',
        missing, olius_test.id('admin'), 'RECORDED', dt, 'Teste negativo'), 'P0002');
    RAISE NOTICE 'PASS: agendamento e correções rejeitam acesso inválido e operações inexistentes';
END $$;

-- B2C: parâmetros e beneficiário/validador inválidos.
DO $$
DECLARE dt TIMESTAMPTZ := CURRENT_TIMESTAMP - INTERVAL '1 hour';
BEGIN
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(NULL,%L,%L,%L,10,%L,NULL)',
        olius_test.id('citizen'), olius_test.id('pev'), olius_test.id('validator'), dt), '22023');
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,10,%L,NULL)',
        gen_random_uuid(), olius_test.id('citizen'), olius_test.id('pev'), gen_random_uuid(), dt), '42501');
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,10,%L,NULL)',
        gen_random_uuid(), gen_random_uuid(), olius_test.id('pev'), olius_test.id('validator'), dt), '42501');
    PERFORM olius_test.expect_error(format('CALL record_pev_delivery(%L,%L,%L,%L,10,%L,NULL)',
        gen_random_uuid(), olius_test.id('validator'), olius_test.id('pev'), olius_test.id('validator'), dt), '42501');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM delivery_pev), 'entregas rejeitadas não são persistidas');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM point_calculation), 'entregas rejeitadas não geram pontuação');
    PERFORM olius_test.assert((SELECT bool_and(points = 0) FROM citizens), 'saldos B2C permanecem zerados');
    RAISE NOTICE 'PASS: entregas B2C inválidas não geram pontos';
END $$;

-- Pagamento inexistente: nenhum benefício ou reembolso deve ser concedido.
DO $$
BEGIN
    PERFORM olius_test.expect_error(format('CALL apply_verified_payment(%L,NULL,NULL,NULL)', gen_random_uuid()), 'P0002');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM payment_application), 'pagamento inexistente não concede benefício');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM payment_refund), 'pagamento inexistente não gera reembolso');
    RAISE NOTICE 'PASS: pagamento inexistente';
END $$;

ROLLBACK;
