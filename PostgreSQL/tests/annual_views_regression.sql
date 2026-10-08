\set ON_ERROR_STOP on
-- Somente banco descartável com 01..07 instalados. Nenhuma massa persiste.
BEGIN;
\ir fixtures_procedures.sql

-- Participantes adicionais para empates e histórico de outro ano.
INSERT INTO olius_test.ids(name) VALUES ('ranking_bia'), ('ranking_caio'), ('ranking_history');
INSERT INTO users(id, name, email, password_hash, user_type)
SELECT id, name, name || '@olius.test', 'hash-apenas-teste', 'CITIZENS'
FROM olius_test.ids WHERE name LIKE 'ranking_%';
INSERT INTO user_qr_code(user_id, qr_token, user_type)
SELECT id, name || '-qr', 'CITIZENS' FROM olius_test.ids WHERE name LIKE 'ranking_%';
INSERT INTO citizens(id, cpf, qr_token)
SELECT id, CASE name WHEN 'ranking_bia' THEN '55555555555'
                    WHEN 'ranking_caio' THEN '66666666666' ELSE '77777777777' END,
       name || '-qr'
FROM olius_test.ids WHERE name LIKE 'ranking_%';

DO $$
DECLARE
    r UUID;
    c UUID;
    first_failure UUID;
    success UUID;
    success_request UUID;
    d UUID;
    original_delivery UUID;
    caio_delivery UUID;
    token UUID := gen_random_uuid();
    operation_date TIMESTAMPTZ := CURRENT_TIMESTAMP;
    year_start TIMESTAMPTZ := make_timestamptz(
        EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::INTEGER,
        1, 1, 0, 0, 0, 'America/Sao_Paulo');
    expected_year INTEGER := EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
    i INTEGER;
    e RECORD;
    current_count BIGINT;
    history_count BIGINT;
    balance_before_query BIGINT;
BEGIN
    PERFORM olius_test.assert(
        (SELECT relkind = 'v' FROM pg_class WHERE oid = 'public.vw_annual_scores'::regclass)
        AND (SELECT relkind = 'v' FROM pg_class WHERE oid = 'public.vw_annual_ranking'::regclass),
        'os dois objetos são views normais');
    PERFORM olius_test.assert(
        (SELECT array_agg(attname::TEXT || ':' || format_type(atttypid, atttypmod) ORDER BY attnum)
         FROM pg_attribute WHERE attrelid = 'public.vw_annual_ranking'::regclass
           AND attnum > 0 AND NOT attisdropped)
        = ARRAY['profile:text', 'ranking_year:integer', 'participant_id:uuid',
                'annual_points:numeric', 'ranking_position:bigint'],
        'contrato de cinco campos e tipos para integração');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking),
        'sem operações não há participantes');
    CALL create_collection_request(olius_test.id('est'), 10, 'Somente pedido', gen_random_uuid(), r);
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking),
        'solicitação sem coleta não habilita ranking');
    RAISE NOTICE 'PASS: views normais, contrato e elegibilidade';

    r := olius_test.request();
    CALL record_collection(r, olius_test.id('driver'), 1, 10, 'ACCEPTABLE', FALSE,
        ARRAY['VOLUME_OUT_OF_TOLERANCE'], NULL, operation_date, first_failure);
    PERFORM olius_test.assert((SELECT annual_points = 0 FROM public.vw_annual_scores
        WHERE participant_id = olius_test.id('est')), 'penalidade válida habilita score zero');
    success_request := olius_test.request();
    CALL record_collection(success_request, olius_test.id('driver'), 10, 10, 'ACCEPTABLE', FALSE,
        ARRAY[]::TEXT[], NULL, operation_date, success);
    r := olius_test.request();
    CALL record_collection(r, olius_test.id('driver'), 1, 10, 'ACCEPTABLE', FALSE,
        ARRAY['VOLUME_OUT_OF_TOLERANCE'], NULL, operation_date, c);
    PERFORM olius_test.assert((SELECT annual_points = 10 FROM public.vw_annual_scores
        WHERE profile = 'B2B' AND participant_id = olius_test.id('est')), 'piso zero: -50,+60,-50 = 10');
    PERFORM olius_test.assert((SELECT count(*) = 2 FROM point_transaction pt
        JOIN point_calculation pc ON pc.id = pt.point_calculation_id
        WHERE pc.collection_id = success AND pc.is_current), 'componentes não multiplicam pontos');

    CALL record_pev_delivery(token, olius_test.id('citizen'), olius_test.id('pev'),
        olius_test.id('validator'), 25, operation_date, original_delivery);
    CALL record_pev_delivery(gen_random_uuid(), olius_test.id('ranking_bia'), olius_test.id('pev'),
        olius_test.id('validator'), 25, operation_date, d);
    CALL record_pev_delivery(gen_random_uuid(), olius_test.id('ranking_caio'), olius_test.id('pev'),
        olius_test.id('validator'), 10, operation_date, caio_delivery);
    PERFORM olius_test.assert(
        (SELECT array_agg(ranking_position ORDER BY annual_points DESC, participant_id)
         FROM public.vw_annual_ranking WHERE profile = 'B2C') = ARRAY[1,1,2]::BIGINT[],
        'DENSE_RANK preserva empates 1,1,2');
    PERFORM olius_test.assert((SELECT ranking_position = 1 FROM public.vw_annual_ranking
        WHERE profile = 'B2B'), 'posição B2B independente das posições B2C');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking
        WHERE participant_id IN (olius_test.id('validator'), olius_test.id('billing_est'))),
        'não incluir validador nem estabelecimento sem operação');
    RAISE NOTICE 'PASS: piso zero, componentes, perfis separados e empates';

    SELECT count(*) FILTER (WHERE is_current), count(*) FILTER (WHERE NOT is_current)
    INTO current_count, history_count FROM point_calculation;
    CALL record_pev_delivery(token, olius_test.id('citizen'), olius_test.id('pev'),
        olius_test.id('validator'), 25, operation_date, d);
    PERFORM olius_test.assert(d = original_delivery, 'reenvio B2C retorna a mesma entrega');
    CALL record_collection(success_request, olius_test.id('driver'), 10, 10, 'ACCEPTABLE', FALSE,
        ARRAY[]::TEXT[], NULL, operation_date, c);
    PERFORM olius_test.assert(c = success, 'reenvio B2B retorna a mesma coleta');
    PERFORM olius_test.assert((SELECT count(*) FILTER (WHERE is_current) = current_count
        AND count(*) FILTER (WHERE NOT is_current) = history_count FROM point_calculation),
        'reenvios não duplicam cálculos');
    PERFORM olius_test.assert((SELECT annual_points = 25 FROM public.vw_annual_scores
        WHERE participant_id = olius_test.id('citizen')), 'reenvio não incrementa o score');
    RAISE NOTICE 'PASS: idempotência B2B/B2C consultada nas views';

    CALL correct_pev_delivery(original_delivery, 1, olius_test.id('admin'), 'RECORDED',
        5, operation_date, 'Correção de volume para testar a view');
    PERFORM olius_test.assert((SELECT annual_points = 5 AND ranking_position = 3
        FROM public.vw_annual_ranking WHERE participant_id = olius_test.id('citizen')),
        'correção refletida sem REFRESH');
    PERFORM olius_test.assert(EXISTS(SELECT 1 FROM point_calculation
        WHERE delivery_pev_id = original_delivery AND NOT is_current AND points_total = 25),
        'revisão antiga preservada e excluída do score');
    CALL correct_pev_delivery(caio_delivery, 1, olius_test.id('admin'), 'ANNULLED',
        NULL, NULL, 'Anulação para testar a view');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking
        WHERE participant_id = olius_test.id('ranking_caio')), 'última entrega anulada remove participante');
    PERFORM olius_test.assert((SELECT ranking_position = 2 FROM public.vw_annual_ranking
        WHERE participant_id = olius_test.id('citizen')), 'posições atualizadas após anulação');
    RAISE NOTICE 'PASS: correções, revisões e anulações sem REFRESH';

    CALL correct_collection(first_failure, 1, olius_test.id('admin'), 'RECORDED',
        10, 10, 'ACCEPTABLE', FALSE, ARRAY[]::TEXT[], NULL, 'Reconstrução B2B para testar view');
    PERFORM olius_test.assert((SELECT annual_points = 70 FROM public.vw_annual_scores
        WHERE profile = 'B2B'), 'correção anterior reconstrói os efeitos posteriores');
    FOR i IN 1..8 LOOP
        r := olius_test.request();
        CALL record_collection(r, olius_test.id('driver'), 10, 10, 'ACCEPTABLE', FALSE,
            ARRAY[]::TEXT[], NULL, operation_date, c);
    END LOOP;
    PERFORM olius_test.assert((SELECT annual_points = 560 FROM public.vw_annual_scores
        WHERE profile = 'B2B'), 'recorrência vigente entra no score anual');
    PERFORM olius_test.assert((SELECT successful_collections_count = 10 AND points_total = 70
        FROM point_calculation WHERE collection_id = c AND is_current), 'décimo sucesso inclui bônus');
    RAISE NOTICE 'PASS: reconstrução B2B e recorrência';

    -- 02:59:59 UTC ainda é o ano anterior em São Paulo na fronteira usada.
    CALL record_pev_delivery(gen_random_uuid(), olius_test.id('ranking_history'), olius_test.id('pev'),
        olius_test.id('validator'), 100, year_start - INTERVAL '1 second', d);
    PERFORM olius_test.assert((SELECT points = 100 FROM citizens
        WHERE id = olius_test.id('ranking_history')), 'saldo geral preserva ano anterior');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_scores
        WHERE participant_id = olius_test.id('ranking_history')), 'data da operação define o ano, não calculated_at');
    CALL record_pev_delivery(gen_random_uuid(), olius_test.id('ranking_history'), olius_test.id('pev'),
        olius_test.id('validator'), 3, year_start, d);
    PERFORM olius_test.assert((SELECT annual_points = 3 AND ranking_year = expected_year
        FROM public.vw_annual_scores WHERE participant_id = olius_test.id('ranking_history')),
        'início anual inclusivo; histórico não contamina score');
    PERFORM set_config('TimeZone', 'Pacific/Kiritimati', TRUE);
    PERFORM olius_test.assert((SELECT annual_points = 3 AND ranking_year = expected_year
        FROM public.vw_annual_scores WHERE participant_id = olius_test.id('ranking_history')),
        'fuso da sessão não muda a classificação oficial');
    PERFORM set_config('TimeZone', 'UTC', TRUE);
    RAISE NOTICE 'PASS: fronteira anual, fuso oficial e saldo geral separado';

    FOR e IN SELECT id, revision FROM collection
        WHERE result = 'SUCCESSFUL' AND record_status = 'RECORDED' ORDER BY processing_order
    LOOP
        CALL correct_collection(e.id, e.revision, olius_test.id('admin'), 'ANNULLED',
            NULL, NULL, NULL, NULL, NULL, NULL, 'Anular sucessos para testar score zero');
    END LOOP;
    PERFORM olius_test.assert((SELECT annual_points = 0 AND ranking_position = 1
        FROM public.vw_annual_ranking WHERE profile = 'B2B'), 'penalidade válida mantém participante com zero');
    FOR e IN SELECT id, revision FROM collection
        WHERE record_status = 'RECORDED' ORDER BY processing_order
    LOOP
        CALL correct_collection(e.id, e.revision, olius_test.id('admin'), 'ANNULLED',
            NULL, NULL, NULL, NULL, NULL, NULL, 'Anular última operação válida');
    END LOOP;
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking
        WHERE profile = 'B2B'), 'sem operação válida no ano sai do ranking');
    SELECT points INTO balance_before_query FROM citizens WHERE id = olius_test.id('citizen');
    PERFORM * FROM public.vw_annual_ranking;
    PERFORM olius_test.assert((SELECT points = balance_before_query FROM citizens
        WHERE id = olius_test.id('citizen')), 'consultar ranking não modifica saldo');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking
        GROUP BY profile, ranking_year, participant_id HAVING count(*) > 1), 'chave do contrato sem duplicação');
    RAISE NOTICE 'PASS: zero pontos, exclusão após última anulação e leitura sem efeitos';
END $$;

ROLLBACK;
\echo 'PASS: regressões das views; massa revertida'
