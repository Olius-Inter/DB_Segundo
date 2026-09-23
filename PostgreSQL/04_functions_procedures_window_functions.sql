/*
===============================================================================
PROJETO.............: ÓLEO AMIGO — OLIUS
BANCO DE DADOS......: PostgreSQL 16.15 (alvo)
SCRIPT..............: 04 - Functions, Procedures e Window Functions de Negócio
SEÇÃO................: 01 - Functions
===============================================================================

As functions desta seção são exclusivamente de consulta e cálculo. A criação
de reservas, a persistência de pontos e a concessão de certificados pertencem
às procedures do Script 04.
*/

BEGIN;

-- =============================================================================
-- 1. Disponibilidade do ciclo
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_cycle_availability(
    p_subscription_cycle_id UUID
)
RETURNS TABLE (
    cycle_id UUID,
    establishment_id UUID,
    volume_limit_liters NUMERIC,
    collection_limit INTEGER,
    reserved_volume_liters NUMERIC,
    reserved_collection_slots BIGINT,
    consumed_volume_liters NUMERIC,
    consumed_collection_slots BIGINT,
    forfeited_volume_liters NUMERIC,
    forfeited_collection_slots BIGINT,
    available_volume_liters NUMERIC,
    available_collection_slots BIGINT,
    is_subscription_active BOOLEAN,
    is_cycle_current BOOLEAN,
    can_accept_new_request BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.subscription_cycle AS sc
        WHERE sc.id = p_subscription_cycle_id
    ) THEN
        RAISE EXCEPTION 'O ciclo de assinatura % não existe.', p_subscription_cycle_id
            USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    WITH cycle_context AS (
        SELECT
            sc.id AS cycle_id,
            sc.establishment_id,
            sc.volume_limit_liters,
            sc.collection_limit,
            (es.status = 'ACTIVE'::public.subscription_status_t) AS is_subscription_active,
            (CURRENT_TIMESTAMP >= sc.starts_at AND CURRENT_TIMESTAMP < sc.ends_at) AS is_cycle_current
        FROM public.subscription_cycle AS sc
        JOIN public.establishment_subscription AS es
            ON es.id = sc.subscription_id
           AND es.establishment_id = sc.establishment_id
        WHERE sc.id = p_subscription_cycle_id
    ),
    reserved AS (
        -- A reserva começa em PENDING e persiste em APPROVED. Depois que uma
        -- collection existe, ela deixa de ser reserva: o consumo é calculado
        -- exclusivamente no CTE consumed, evitando dupla contagem.
        SELECT
            cr.subscription_cycle_id AS cycle_id,
            COALESCE(SUM(cr.estimated_volume_liters), 0::NUMERIC) AS volume_liters,
            COUNT(*)::BIGINT AS collection_slots
        FROM public.collection_request AS cr
        WHERE cr.subscription_cycle_id = p_subscription_cycle_id
          AND cr.status IN ('PENDING'::public.request_status_t, 'APPROVED'::public.request_status_t)
          AND NOT EXISTS (
              SELECT 1
              FROM public.collection AS c
              WHERE c.collection_request_id = cr.id
          )
        GROUP BY cr.subscription_cycle_id
    ),
    consumed AS (
        -- Uma visita registrada, inclusive malsucedida, consome o volume
        -- efetivamente recolhido e uma vaga do ciclo de origem da solicitação.
        SELECT
            cr.subscription_cycle_id AS cycle_id,
            COALESCE(SUM(c.collected_volume_liters), 0::NUMERIC) AS volume_liters,
            COUNT(*)::BIGINT AS collection_slots
        FROM public.collection AS c
        JOIN public.collection_request AS cr
            ON cr.id = c.collection_request_id
        WHERE cr.subscription_cycle_id = p_subscription_cycle_id
          AND c.record_status = 'RECORDED'::public.record_status_t
        GROUP BY cr.subscription_cycle_id
    ),
    forfeited AS (
        -- Cancelamentos tardios não geram collection. Seus campos próprios
        -- representam a franquia perdida e não são volume ambiental.
        SELECT
            cr.subscription_cycle_id AS cycle_id,
            COALESCE(SUM(cr.forfeited_volume_liters), 0::NUMERIC) AS volume_liters,
            COALESCE(SUM(cr.forfeited_collection_slots), 0)::BIGINT AS collection_slots
        FROM public.collection_request AS cr
        WHERE cr.subscription_cycle_id = p_subscription_cycle_id
          AND cr.status = 'CANCELLED'::public.request_status_t
        GROUP BY cr.subscription_cycle_id
    ),
    availability AS (
        SELECT
            cc.*,
            COALESCE(r.volume_liters, 0::NUMERIC) AS reserved_volume_liters,
            COALESCE(r.collection_slots, 0::BIGINT) AS reserved_collection_slots,
            COALESCE(c.volume_liters, 0::NUMERIC) AS consumed_volume_liters,
            COALESCE(c.collection_slots, 0::BIGINT) AS consumed_collection_slots,
            COALESCE(f.volume_liters, 0::NUMERIC) AS forfeited_volume_liters,
            COALESCE(f.collection_slots, 0::BIGINT) AS forfeited_collection_slots
        FROM cycle_context AS cc
        LEFT JOIN reserved AS r ON r.cycle_id = cc.cycle_id
        LEFT JOIN consumed AS c ON c.cycle_id = cc.cycle_id
        LEFT JOIN forfeited AS f ON f.cycle_id = cc.cycle_id
    )
    SELECT
        a.cycle_id,
        a.establishment_id,
        a.volume_limit_liters,
        a.collection_limit,
        a.reserved_volume_liters,
        a.reserved_collection_slots,
        a.consumed_volume_liters,
        a.consumed_collection_slots,
        a.forfeited_volume_liters,
        a.forfeited_collection_slots,
        GREATEST(
            a.volume_limit_liters
                - a.reserved_volume_liters
                - a.consumed_volume_liters
                - a.forfeited_volume_liters,
            0::NUMERIC
        ) AS available_volume_liters,
        GREATEST(
            a.collection_limit::BIGINT
                - a.reserved_collection_slots
                - a.consumed_collection_slots
                - a.forfeited_collection_slots,
            0::BIGINT
        ) AS available_collection_slots,
        a.is_subscription_active,
        a.is_cycle_current,
        (
            a.is_subscription_active
            AND a.is_cycle_current
            AND a.volume_limit_liters
                    - a.reserved_volume_liters
                    - a.consumed_volume_liters
                    - a.forfeited_volume_liters > 0::NUMERIC
            AND a.collection_limit::BIGINT
                    - a.reserved_collection_slots
                    - a.consumed_collection_slots
                    - a.forfeited_collection_slots > 0::BIGINT
        ) AS can_accept_new_request
    FROM availability AS a;
END;
$$;

COMMENT ON FUNCTION public.get_cycle_availability(UUID) IS
'Consulta a disponibilidade B2B de um ciclo, separando reservas, consumo e perdas por cancelamento tardio, sem criar reservas.';

-- =============================================================================
-- 2. Cálculo da pontuação de uma coleta
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_collection_score(
    p_collection_id UUID
)
RETURNS TABLE (
    collection_id UUID,
    establishment_id UUID,
    successful_collections_count BIGINT,
    volume_points BIGINT,
    success_bonus_points BIGINT,
    recurrence_bonus_points BIGINT,
    failure_penalty_points BIGINT,
    nominal_points_total BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_collection public.collection%ROWTYPE;
    v_successful_collections_count BIGINT;
BEGIN
    SELECT c.*
    INTO v_collection
    FROM public.collection AS c
    WHERE c.id = p_collection_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A coleta % não existe.', p_collection_id
            USING ERRCODE = 'P0002';
    END IF;

    -- processing_order é a ordem lógica e imutável da reconstrução. Falhas
    -- ficam fora da contagem, portanto não reiniciam os sucessos acumulados.
    -- ANNULLED também fica fora, inclusive quando a anulação é posterior.
    SELECT COUNT(*)::BIGINT
    INTO v_successful_collections_count
    FROM public.collection AS c
    WHERE c.establishment_id = v_collection.establishment_id
      AND c.processing_order <= v_collection.processing_order
      AND c.record_status = 'RECORDED'::public.record_status_t
      AND c.result = 'SUCCESSFUL'::public.collection_result_t;

    RETURN QUERY
    SELECT
        v_collection.id,
        v_collection.establishment_id,
        v_successful_collections_count,
        CASE
            WHEN v_collection.record_status = 'RECORDED'::public.record_status_t
             AND v_collection.result = 'SUCCESSFUL'::public.collection_result_t
                THEN FLOOR(v_collection.collected_volume_liters)::BIGINT
            ELSE 0::BIGINT
        END AS volume_points,
        CASE
            WHEN v_collection.record_status = 'RECORDED'::public.record_status_t
             AND v_collection.result = 'SUCCESSFUL'::public.collection_result_t
                THEN 50::BIGINT
            ELSE 0::BIGINT
        END AS success_bonus_points,
        CASE
            WHEN v_collection.record_status = 'RECORDED'::public.record_status_t
             AND v_collection.result = 'SUCCESSFUL'::public.collection_result_t
             AND v_successful_collections_count % 10 = 0
                THEN LEAST(v_successful_collections_count, 100::BIGINT)
            ELSE 0::BIGINT
        END AS recurrence_bonus_points,
        CASE
            WHEN v_collection.record_status = 'RECORDED'::public.record_status_t
             AND v_collection.result = 'UNSUCCESSFUL'::public.collection_result_t
                THEN -50::BIGINT
            ELSE 0::BIGINT
        END AS failure_penalty_points,
        CASE
            WHEN v_collection.record_status = 'ANNULLED'::public.record_status_t THEN 0::BIGINT
            WHEN v_collection.result = 'UNSUCCESSFUL'::public.collection_result_t THEN -50::BIGINT
            ELSE FLOOR(v_collection.collected_volume_liters)::BIGINT
                + 50::BIGINT
                + CASE
                    WHEN v_successful_collections_count % 10 = 0
                        THEN LEAST(v_successful_collections_count, 100::BIGINT)
                    ELSE 0::BIGINT
                END
        END AS nominal_points_total;
END;
$$;

COMMENT ON FUNCTION public.calculate_collection_score(UUID) IS
'Calcula os componentes nominais de pontos de uma coleta B2B; o piso zero do saldo é aplicado somente na reconstrução persistida.';

-- =============================================================================
-- 3. Progresso ambiental dos certificados
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_certificate_progress(
    p_establishment_id UUID
)
RETURNS TABLE (
    establishment_id UUID,
    eligible_volume_liters NUMERIC,
    certificate_level_id UUID,
    level_name VARCHAR,
    level_description TEXT,
    required_liters NUMERIC,
    is_level_reached BOOLEAN,
    remaining_liters NUMERIC,
    certificate_id UUID,
    certificate_status public.certificate_status_t
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_eligible_volume_liters NUMERIC;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.establishment AS e
        WHERE e.id = p_establishment_id
    ) THEN
        RAISE EXCEPTION 'O estabelecimento % não existe.', p_establishment_id
            USING ERRCODE = 'P0002';
    END IF;

    -- O volume ambiental oficial conta toda collection RECORDED, inclusive
    -- UNSUCCESSFUL. ANNULLED deixa de contribuir, e não entram reservas,
    -- perdas por cancelamento, pontos ou entregas B2C em PEV.
    SELECT COALESCE(SUM(c.collected_volume_liters), 0::NUMERIC)
    INTO v_eligible_volume_liters
    FROM public.collection AS c
    WHERE c.establishment_id = p_establishment_id
      AND c.record_status = 'RECORDED'::public.record_status_t;

    -- Sem certificate_level cadastrado, o SELECT retorna zero linhas: não é
    -- criado um nível artificial apenas para sinalizar falta de configuração.
    RETURN QUERY
    SELECT
        p_establishment_id,
        v_eligible_volume_liters,
        cl.id,
        cl.name,
        cl.description,
        cl.required_liters,
        v_eligible_volume_liters >= cl.required_liters AS is_level_reached,
        GREATEST(cl.required_liters - v_eligible_volume_liters, 0::NUMERIC) AS remaining_liters,
        cert.id,
        cert.status
    FROM public.certificate_level AS cl
    LEFT JOIN public.certificate AS cert
        ON cert.certificate_level_id = cl.id
       AND cert.establishment_id = p_establishment_id
    ORDER BY cl.required_liters, cl.name, cl.id;
END;
$$;

COMMENT ON FUNCTION public.get_certificate_progress(UUID) IS
'Consulta o volume ambiental elegível e o progresso por nível de certificado, sem emitir, revogar ou reativar concessões.';

COMMIT;
