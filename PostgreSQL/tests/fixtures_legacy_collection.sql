-- Contrato anterior à Sprint 9, somente para testar migração com dados existentes.
CREATE OR REPLACE PROCEDURE public.record_collection(
    IN p_collection_request_id UUID,
    IN p_driver_id UUID,
    IN p_collected_volume_liters NUMERIC,
    IN p_presented_volume_liters NUMERIC,
    IN p_oil_condition public.oil_condition_t,
    IN p_has_compromising_occurrence BOOLEAN,
    IN p_failure_reason_codes TEXT[],
    IN p_observation TEXT,
    IN p_collection_date TIMESTAMPTZ,
    OUT p_collection_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    c_volume_lower CONSTANT NUMERIC := 0.90;
    c_volume_upper CONSTANT NUMERIC := 1.10;
    c_failure_penalty CONSTANT BIGINT := -50;
    c_success_bonus CONSTANT BIGINT := 50;
    c_recurrence_cap CONSTANT BIGINT := 100;
    c_recurrence_interval CONSTANT BIGINT := 10;
    c_active CONSTANT public.active_status_t := 'ACTIVE';
    c_request_approved CONSTANT public.request_status_t := 'APPROVED';
    c_unsuccessful CONSTANT public.collection_result_t := 'UNSUCCESSFUL';
    c_successful CONSTANT public.collection_result_t := 'SUCCESSFUL';
    c_recorded CONSTANT public.record_status_t := 'RECORDED';
    c_not_assessed CONSTANT public.oil_condition_t := 'NOT_ASSESSED';
    c_unacceptable CONSTANT public.oil_condition_t := 'UNACCEPTABLE';
    c_acceptable CONSTANT public.oil_condition_t := 'ACCEPTABLE';
    c_err_parameter CONSTANT TEXT := '22023';
    c_err_authorization CONSTANT TEXT := '42501';
    c_err_state CONSTANT TEXT := '55000';
    c_err_constraint CONSTANT TEXT := '23514';
    c_err_idempotency CONSTANT TEXT := '22000';
    c_reason_volume CONSTANT TEXT := 'VOLUME_OUT_OF_TOLERANCE';
    c_reason_oil CONSTANT TEXT := 'OIL_UNACCEPTABLE';
    c_reason_occurrence CONSTANT TEXT := 'COMPROMISING_OCCURRENCE';
    v_request public.collection_request%ROWTYPE;
    v_driver public.driver%ROWTYPE;
    v_original public.collection%ROWTYPE;
    v_original_codes TEXT[];
    v_result public.collection_result_t;
    v_volume_out BOOLEAN;
    v_codes TEXT[] := COALESCE(p_failure_reason_codes, ARRAY[]::TEXT[]);
    v_order BIGINT;
    v_found_count INTEGER;
    v_success_count BIGINT;
    v_points BIGINT;
BEGIN
    -- Não usar ANY/COUNT antes de rejeitar NULLs: SQL usa lógica de três valores.
    IF EXISTS (SELECT 1 FROM unnest(v_codes) AS r(code) WHERE code IS NULL OR BTRIM(code) = '') THEN
        RAISE EXCEPTION 'A lista de motivos não pode conter elementos nulos ou vazios.' USING ERRCODE = c_err_parameter;
    END IF;
    SELECT COALESCE(array_agg(DISTINCT code ORDER BY code), ARRAY[]::TEXT[])
    INTO v_codes FROM unnest(v_codes) AS r(code);
    IF p_collected_volume_liters IS NULL OR p_collected_volume_liters < 0
       OR p_collected_volume_liters IN ('NaN'::NUMERIC, 'Infinity'::NUMERIC, '-Infinity'::NUMERIC)
       OR p_collected_volume_liters <> ROUND(p_collected_volume_liters, 2)
       OR p_presented_volume_liters IS NULL OR p_presented_volume_liters < 0
       OR p_presented_volume_liters IN ('NaN'::NUMERIC, 'Infinity'::NUMERIC, '-Infinity'::NUMERIC)
       OR p_presented_volume_liters <> ROUND(p_presented_volume_liters, 2)
       OR p_collected_volume_liters > p_presented_volume_liters
       OR p_collection_date IS NULL OR NOT isfinite(p_collection_date)
       OR p_collection_date > clock_timestamp() OR p_has_compromising_occurrence IS NULL
       OR p_oil_condition IS NULL
       OR (p_presented_volume_liters = 0 AND p_oil_condition <> c_not_assessed)
       OR (p_presented_volume_liters > 0 AND p_oil_condition = c_not_assessed)
       OR (p_observation IS NOT NULL AND BTRIM(p_observation) = '') THEN
        RAISE EXCEPTION 'Volume, data, ocorrência ou observação informados são inválidos.' USING ERRCODE = c_err_parameter;
    END IF;
    SELECT d.* INTO v_driver FROM public.driver d WHERE d.id = p_driver_id FOR SHARE;
    IF NOT FOUND OR v_driver.status <> c_active THEN
        RAISE EXCEPTION 'O motorista não existe ou não está ativo.' USING ERRCODE = c_err_authorization;
    END IF;
    -- Ordem global B2B: estabelecimento, solicitação, evento/cálculos.
    SELECT cr.* INTO v_request FROM public.collection_request cr
    WHERE cr.id = p_collection_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A solicitação não existe.' USING ERRCODE = 'P0002'; END IF;
    PERFORM 1 FROM public.establishment e WHERE e.id = v_request.establishment_id FOR UPDATE;
    SELECT cr.* INTO v_request FROM public.collection_request cr
    WHERE cr.id = p_collection_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A solicitação não existe.' USING ERRCODE = 'P0002'; END IF;
    SELECT c.id INTO p_collection_id FROM public.collection c WHERE c.collection_request_id = v_request.id;
    IF FOUND THEN
        SELECT (jsonb_populate_record(NULL::public.collection, to_jsonb(l))).*
        INTO v_original FROM public.collection_log AS l
        WHERE l.id = p_collection_id AND l.operation = 'INSERT' AND l.snapshot_kind = 'AFTER'
        ORDER BY l.performed_at, l.log_id LIMIT 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'O histórico original da coleta não está disponível para validar o reenvio.' USING ERRCODE = c_err_state;
        END IF;
        -- As associações originais são os INSERTs anteriores à primeira
        -- alteração administrativa da revisão. A correção atualiza o evento
        -- antes de substituir motivos, preservando essa fronteira no histórico.
        SELECT COALESCE(array_agg(DISTINCT cfr.code::TEXT ORDER BY cfr.code::TEXT), ARRAY[]::TEXT[])
        INTO v_original_codes
        FROM public.collection_failure_log AS fl
        JOIN public.collection_failure_reason AS cfr ON cfr.id = fl.failure_reason_id
        WHERE fl.collection_id = p_collection_id AND fl.operation = 'INSERT' AND fl.snapshot_kind = 'AFTER'
          AND fl.performed_at < LEAST(
              COALESCE((SELECT MIN(cl.performed_at) FROM public.collection_log AS cl
                        WHERE cl.id = p_collection_id AND cl.operation = 'UPDATE' AND cl.snapshot_kind = 'BEFORE'
                          AND 'revision' = ANY(cl.changed_columns)), 'infinity'::TIMESTAMPTZ),
              COALESCE((SELECT MIN(dl.performed_at) FROM public.collection_failure_log AS dl
                        WHERE dl.collection_id = p_collection_id AND dl.operation = 'DELETE'), 'infinity'::TIMESTAMPTZ)
          );
        IF v_original.result = c_successful THEN
            v_original_codes := ARRAY[]::TEXT[];
        END IF;
        IF v_original.driver_id IS DISTINCT FROM p_driver_id
           OR v_original.collected_volume_liters IS DISTINCT FROM p_collected_volume_liters
           OR v_original.presented_volume_liters IS DISTINCT FROM p_presented_volume_liters
           OR v_original.oil_condition IS DISTINCT FROM p_oil_condition
           OR v_original.has_compromising_occurrence IS DISTINCT FROM p_has_compromising_occurrence
           OR v_original.observation IS DISTINCT FROM p_observation
           OR v_original.collection_date IS DISTINCT FROM p_collection_date
           OR v_original_codes IS DISTINCT FROM v_codes THEN
            RAISE EXCEPTION 'Conflito de idempotência: a solicitação já possui coleta com dados originais diferentes.' USING ERRCODE = c_err_idempotency;
        END IF;
        RETURN;
    END IF;
    IF v_request.status <> c_request_approved OR v_request.scheduled_at IS NULL THEN
        RAISE EXCEPTION 'A solicitação precisa estar aprovada e agendada.' USING ERRCODE = c_err_state;
    END IF;
    IF v_request.arrival_driver_id IS DISTINCT FROM p_driver_id
       OR v_request.service_accepted_at IS NULL
       OR v_request.service_accepted_by IS DISTINCT FROM v_request.establishment_id THEN
        RAISE EXCEPTION 'A coleta exige motorista designado e aceite do estabelecimento.' USING ERRCODE = c_err_authorization;
    END IF;
    v_volume_out := p_collected_volume_liters < v_request.estimated_volume_liters * c_volume_lower
                 OR p_collected_volume_liters > v_request.estimated_volume_liters * c_volume_upper;
    v_result := CASE WHEN NOT v_volume_out
        AND p_oil_condition = c_acceptable
        AND NOT p_has_compromising_occurrence
        THEN c_successful
        ELSE c_unsuccessful END;
    IF v_result = c_unsuccessful THEN
        IF cardinality(v_codes) = 0 THEN RAISE EXCEPTION 'Toda coleta malsucedida deve registrar ao menos um motivo.' USING ERRCODE = c_err_constraint; END IF;
        IF v_volume_out AND NOT (c_reason_volume = ANY(v_codes))
           OR p_oil_condition = c_unacceptable AND NOT (c_reason_oil = ANY(v_codes))
           OR p_has_compromising_occurrence AND NOT (c_reason_occurrence = ANY(v_codes)) THEN
            RAISE EXCEPTION 'Os motivos devem corresponder aos fatos que tornaram a coleta malsucedida.' USING ERRCODE = c_err_constraint;
        END IF;
        IF (c_reason_volume = ANY(v_codes) AND NOT v_volume_out)
           OR (c_reason_oil = ANY(v_codes) AND p_oil_condition <> c_unacceptable)
           OR (c_reason_occurrence = ANY(v_codes) AND NOT p_has_compromising_occurrence) THEN
            RAISE EXCEPTION 'Não é permitido registrar motivos que não correspondam aos dados da coleta.' USING ERRCODE = c_err_constraint;
        END IF;
    ELSIF cardinality(v_codes) > 0 THEN
        RAISE EXCEPTION 'Uma coleta bem-sucedida não pode possuir motivos de insucesso.' USING ERRCODE = c_err_constraint;
    END IF;
    IF cardinality(v_codes) > 0 THEN
        SELECT COUNT(DISTINCT cfr.code)::INTEGER INTO v_found_count
        FROM public.collection_failure_reason cfr
        WHERE cfr.code = ANY(v_codes) AND cfr.status = c_active;
        IF v_found_count <> (SELECT COUNT(DISTINCT code) FROM unnest(v_codes) AS reason_codes(code)) THEN
            RAISE EXCEPTION 'Um ou mais motivos de insucesso não existem ou estão inativos.' USING ERRCODE = '23503';
        END IF;
    END IF;
    -- O estabelecimento já está bloqueado; anuladas conservam sua ordem.
    SELECT COALESCE(MAX(c.processing_order), 0) + 1 INTO v_order
    FROM public.collection c WHERE c.establishment_id = v_request.establishment_id;
    IF v_result = c_successful THEN
        SELECT COUNT(*) INTO v_success_count FROM public.collection c
        WHERE c.establishment_id = v_request.establishment_id
          AND c.record_status = c_recorded
          AND c.result = c_successful;
        v_success_count := v_success_count + 1;
        v_points := FLOOR(p_collected_volume_liters)::BIGINT + c_success_bonus
            + CASE WHEN v_success_count % c_recurrence_interval = 0 THEN LEAST(v_success_count, c_recurrence_cap) ELSE 0 END;
    ELSE
        v_points := c_failure_penalty;
    END IF;
    INSERT INTO public.collection (
        collected_volume_liters, presented_volume_liters, oil_condition,
        has_compromising_occurrence, result, points_earned, observation,
        collection_date, collection_request_id, establishment_id,
        processing_order, driver_id, record_status, revision, created_at
    ) VALUES (
        p_collected_volume_liters, p_presented_volume_liters, p_oil_condition,
        p_has_compromising_occurrence, v_result, v_points, p_observation,
        p_collection_date, v_request.id, v_request.establishment_id,
        v_order, p_driver_id, c_recorded, 1, clock_timestamp()
    ) RETURNING id INTO p_collection_id;
    IF cardinality(v_codes) > 0 THEN
        INSERT INTO public.collection_failure (collection_id, failure_reason_id)
        SELECT p_collection_id, cfr.id FROM public.collection_failure_reason cfr
        WHERE cfr.code = ANY(v_codes) AND cfr.status = c_active;
    END IF;
    CALL public.rebuild_user_points(v_request.establishment_id, NULL, NULL);
    CALL public.reconcile_establishment_certificates(v_request.establishment_id);
END;
$$;

COMMENT ON PROCEDURE public.record_collection(UUID, UUID, NUMERIC, NUMERIC, public.oil_condition_t, BOOLEAN, TEXT[], TEXT, TIMESTAMPTZ) IS
'Registra coleta B2B uma única vez, deriva resultado e razões de falha, reconstrói pontos e reconcilia certificados.';

CREATE OR REPLACE PROCEDURE public.correct_collection(
    IN p_collection_id UUID,
    IN p_expected_revision INTEGER,
    IN p_admin_id UUID,
    IN p_record_status public.record_status_t,
    IN p_collected_volume_liters NUMERIC,
    IN p_presented_volume_liters NUMERIC,
    IN p_oil_condition public.oil_condition_t,
    IN p_has_compromising_occurrence BOOLEAN,
    IN p_failure_reason_codes TEXT[],
    IN p_observation TEXT,
    IN p_correction_reason TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    c_volume_lower CONSTANT NUMERIC := 0.90;
    c_volume_upper CONSTANT NUMERIC := 1.10;
    c_failure_penalty CONSTANT BIGINT := -50;
    c_success_bonus CONSTANT BIGINT := 50;
    c_recurrence_cap CONSTANT BIGINT := 100;
    c_recurrence_interval CONSTANT BIGINT := 10;
    c_active CONSTANT public.active_status_t := 'ACTIVE';
    c_unsuccessful CONSTANT public.collection_result_t := 'UNSUCCESSFUL';
    c_successful CONSTANT public.collection_result_t := 'SUCCESSFUL';
    c_annulled CONSTANT public.record_status_t := 'ANNULLED';
    c_recorded CONSTANT public.record_status_t := 'RECORDED';
    c_admin CONSTANT public.user_type_t := 'ADMIN';
    c_not_assessed CONSTANT public.oil_condition_t := 'NOT_ASSESSED';
    c_unacceptable CONSTANT public.oil_condition_t := 'UNACCEPTABLE';
    c_acceptable CONSTANT public.oil_condition_t := 'ACCEPTABLE';
    c_err_parameter CONSTANT TEXT := '22023';
    c_err_authorization CONSTANT TEXT := '42501';
    c_err_constraint CONSTANT TEXT := '23514';
    c_reason_volume CONSTANT TEXT := 'VOLUME_OUT_OF_TOLERANCE';
    c_reason_oil CONSTANT TEXT := 'OIL_UNACCEPTABLE';
    c_reason_occurrence CONSTANT TEXT := 'COMPROMISING_OCCURRENCE';
    c_msg_admin CONSTANT TEXT := 'O administrador informado não existe ou não está ativo.';
    v_collection public.collection%ROWTYPE;
    v_request public.collection_request%ROWTYPE;
    v_codes TEXT[] := COALESCE(p_failure_reason_codes, ARRAY[]::TEXT[]);
    v_volume_out BOOLEAN;
    v_result public.collection_result_t;
    v_reason_count INTEGER;
    v_success_count BIGINT;
    v_points BIGINT;
BEGIN
    IF p_expected_revision IS NULL OR p_expected_revision < 1
       OR p_correction_reason IS NULL OR BTRIM(p_correction_reason) = '' THEN
        RAISE EXCEPTION 'A revisão esperada e a justificativa são obrigatórias.' USING ERRCODE = c_err_parameter;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_admin_id
        AND u.user_type = c_admin AND u.status = c_active) THEN
        RAISE EXCEPTION '%', c_msg_admin USING ERRCODE = c_err_authorization;
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_codes) AS r(code) WHERE code IS NULL OR BTRIM(code) = '') THEN
        RAISE EXCEPTION 'A lista de motivos não pode conter elementos nulos ou vazios.' USING ERRCODE = c_err_parameter;
    END IF;
    SELECT COALESCE(array_agg(DISTINCT code ORDER BY code), ARRAY[]::TEXT[])
    INTO v_codes FROM unnest(v_codes) AS r(code);

    -- A primeira leitura identifica o dono, sem bloquear a coleta antes dele.
    SELECT c.* INTO v_collection FROM public.collection c WHERE c.id = p_collection_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A coleta % não existe.', p_collection_id USING ERRCODE = 'P0002'; END IF;
    PERFORM 1 FROM public.establishment e WHERE e.id = v_collection.establishment_id FOR UPDATE;
    SELECT c.* INTO v_collection FROM public.collection c WHERE c.id = p_collection_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A coleta % não existe.', p_collection_id USING ERRCODE = 'P0002'; END IF;
    IF v_collection.revision <> p_expected_revision THEN
        RAISE EXCEPTION 'A coleta mudou desde a leitura. Recarregue o registro antes de corrigir.' USING ERRCODE = '40001';
    END IF;
    SELECT cr.* INTO v_request FROM public.collection_request cr WHERE cr.id = v_collection.collection_request_id;
    IF p_record_status = c_recorded THEN
        IF p_collected_volume_liters IS NULL OR p_collected_volume_liters < 0
           OR p_collected_volume_liters IN ('NaN'::NUMERIC, 'Infinity'::NUMERIC, '-Infinity'::NUMERIC)
           OR p_collected_volume_liters <> ROUND(p_collected_volume_liters, 2) OR p_presented_volume_liters IS NULL
           OR p_presented_volume_liters < 0 OR p_presented_volume_liters IN ('NaN'::NUMERIC, 'Infinity'::NUMERIC, '-Infinity'::NUMERIC)
           OR p_presented_volume_liters <> ROUND(p_presented_volume_liters, 2)
           OR p_collected_volume_liters > p_presented_volume_liters
           OR (p_presented_volume_liters = 0 AND p_oil_condition <> c_not_assessed)
           OR (p_presented_volume_liters > 0 AND p_oil_condition = c_not_assessed)
           OR p_has_compromising_occurrence IS NULL OR p_oil_condition IS NULL
           OR (p_observation IS NOT NULL AND BTRIM(p_observation) = '') THEN
            RAISE EXCEPTION 'Os dados da coleta corrigida são inválidos.' USING ERRCODE = c_err_parameter;
        END IF;
        v_volume_out := p_collected_volume_liters < v_request.estimated_volume_liters * c_volume_lower
                     OR p_collected_volume_liters > v_request.estimated_volume_liters * c_volume_upper;
        v_result := CASE WHEN NOT v_volume_out
            AND p_oil_condition = c_acceptable
            AND NOT p_has_compromising_occurrence
            THEN c_successful ELSE c_unsuccessful END;
        IF v_result = c_unsuccessful AND cardinality(v_codes) = 0 THEN
            RAISE EXCEPTION 'Toda coleta malsucedida deve registrar ao menos um motivo.' USING ERRCODE = c_err_constraint;
        END IF;
        IF (v_volume_out AND NOT (c_reason_volume = ANY(v_codes)))
           OR (p_oil_condition = c_unacceptable AND NOT (c_reason_oil = ANY(v_codes)))
           OR (p_has_compromising_occurrence AND NOT (c_reason_occurrence = ANY(v_codes))) THEN
            RAISE EXCEPTION 'Os motivos devem corresponder aos fatos da coleta corrigida.' USING ERRCODE = c_err_constraint;
        END IF;
        IF (c_reason_volume = ANY(v_codes) AND NOT v_volume_out)
           OR (c_reason_oil = ANY(v_codes) AND p_oil_condition <> c_unacceptable)
           OR (c_reason_occurrence = ANY(v_codes) AND NOT p_has_compromising_occurrence) THEN
            RAISE EXCEPTION 'Não é permitido registrar motivos que não correspondam aos dados corrigidos.' USING ERRCODE = c_err_constraint;
        END IF;
        IF v_result = c_successful AND cardinality(v_codes) > 0 THEN
            RAISE EXCEPTION 'Uma coleta bem-sucedida não pode possuir motivos de insucesso.' USING ERRCODE = c_err_constraint;
        END IF;
    ELSIF p_record_status = c_annulled THEN
        v_result := v_collection.result;
        v_codes := ARRAY[]::TEXT[];
    ELSE
        RAISE EXCEPTION 'A situação corrigida é inválida.' USING ERRCODE = c_err_parameter;
    END IF;
    IF cardinality(v_codes) > 0 THEN
        SELECT COUNT(DISTINCT cfr.code)::INTEGER INTO v_reason_count
        FROM public.collection_failure_reason cfr
        WHERE cfr.code = ANY(v_codes) AND cfr.status = c_active;
        IF v_reason_count <> (SELECT COUNT(DISTINCT code) FROM unnest(v_codes) AS reason_codes(code)) THEN
            RAISE EXCEPTION 'Um ou mais motivos não existem ou estão inativos.' USING ERRCODE = '23503';
        END IF;
    END IF;
    IF p_record_status = c_annulled THEN
        v_points := 0;
    ELSIF v_result = c_unsuccessful THEN
        v_points := c_failure_penalty;
    ELSE
        SELECT COUNT(*) INTO v_success_count FROM public.collection c
        WHERE c.establishment_id = v_collection.establishment_id
          AND c.processing_order < v_collection.processing_order
          AND c.record_status = c_recorded
          AND c.result = c_successful;
        v_success_count := v_success_count + 1;
        v_points := FLOOR(p_collected_volume_liters)::BIGINT + c_success_bonus
            + CASE WHEN v_success_count % c_recurrence_interval = 0 THEN LEAST(v_success_count, c_recurrence_cap) ELSE 0 END;
    END IF;
    -- Registrar a nova revisão antes de substituir associações deixa uma
    -- fronteira auditável para recuperar os motivos da requisição original.
    UPDATE public.collection c
    SET record_status = p_record_status,
        collected_volume_liters = CASE WHEN p_record_status = c_recorded THEN p_collected_volume_liters ELSE c.collected_volume_liters END,
        presented_volume_liters = CASE WHEN p_record_status = c_recorded THEN p_presented_volume_liters ELSE c.presented_volume_liters END,
        oil_condition = CASE WHEN p_record_status = c_recorded THEN p_oil_condition ELSE c.oil_condition END,
        has_compromising_occurrence = CASE WHEN p_record_status = c_recorded THEN p_has_compromising_occurrence ELSE c.has_compromising_occurrence END,
        result = v_result,
        points_earned = v_points,
        observation = CASE WHEN p_record_status = c_annulled OR p_observation IS NULL THEN c.observation ELSE BTRIM(p_observation) END,
        revision = c.revision + 1, corrected_at = clock_timestamp(),
        corrected_by = p_admin_id, correction_reason = BTRIM(p_correction_reason)
    WHERE c.id = p_collection_id;
    DELETE FROM public.collection_failure WHERE collection_id = p_collection_id;
    IF cardinality(v_codes) > 0 THEN
        INSERT INTO public.collection_failure (collection_id, failure_reason_id)
        SELECT p_collection_id, cfr.id FROM public.collection_failure_reason cfr
        WHERE cfr.code = ANY(v_codes) AND cfr.status = c_active;
    END IF;
    CALL public.rebuild_user_points(v_collection.establishment_id, p_admin_id, BTRIM(p_correction_reason));
    CALL public.reconcile_establishment_certificates(v_collection.establishment_id);
END;
$$;

COMMENT ON PROCEDURE public.correct_collection(UUID, INTEGER, UUID, public.record_status_t, NUMERIC, NUMERIC, public.oil_condition_t, BOOLEAN, TEXT[], TEXT, TEXT) IS
'Corrige coleta com revisão esperada, auditoria administrativa, razões coerentes e reconstrução de pontos/certificados.';

