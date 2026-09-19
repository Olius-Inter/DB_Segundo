/*
===============================================================================
PROJETO.............: ÓLEO AMIGO — OLIUS
BANCO DE DADOS......: PostgreSQL 16.15 (alvo)
SCRIPT..............: 05 - Functions de Trigger e Triggers
VERSÃO..............: Reorganizada
===============================================================================

OBJETIVO
-------------------------------------------------------------------------------
Concentrar exclusivamente:
- Functions que retornam TRIGGER;
- Criação/remoção das triggers;
- Consultas de conferência relacionadas às triggers.

DEPENDÊNCIA
-------------------------------------------------------------------------------
Este script deve ser executado DEPOIS do script 04, pois a auditoria utiliza
as functions auxiliares definidas nele.
===============================================================================
*/

-- ============================================================================
-- 1. FUNCTION DE TRIGGER — AUDITORIA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_olius_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_event_id UUID;
    v_row_key TEXT;
    v_changed_columns TEXT[];
    v_old JSONB;
    v_new JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN

        v_event_id := gen_random_uuid();

        PERFORM fn_olius_write_audit_snapshot(
            TG_TABLE_NAME,
            to_jsonb(NEW),
            'INSERT'::operation_status_t,
            'AFTER'::audit_snapshot_t,
            v_event_id,
            ARRAY[]::TEXT[]
        );

        RETURN NEW;
    END IF;


    IF TG_OP = 'DELETE' THEN

        v_event_id := gen_random_uuid();

        PERFORM fn_olius_write_audit_snapshot(
            TG_TABLE_NAME,
            to_jsonb(OLD),
            'DELETE'::operation_status_t,
            'BEFORE'::audit_snapshot_t,
            v_event_id,
            ARRAY[]::TEXT[]
        );

        RETURN OLD;
    END IF;


    /*
    UPDATE — BEFORE
    */
    IF TG_OP = 'UPDATE' AND TG_WHEN = 'BEFORE' THEN

        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        v_event_id := gen_random_uuid();
        v_row_key := fn_olius_audit_row_key(TG_RELID, v_old);

        CREATE TEMP TABLE IF NOT EXISTS pg_temp.olius_audit_events (
            table_name TEXT NOT NULL,
            row_key TEXT NOT NULL,
            audit_event_id UUID NOT NULL,
            PRIMARY KEY (table_name, row_key)
        ) ON COMMIT DELETE ROWS;

        INSERT INTO pg_temp.olius_audit_events (
            table_name,
            row_key,
            audit_event_id
        )
        VALUES (
            TG_TABLE_NAME,
            v_row_key,
            v_event_id
        )
        ON CONFLICT (table_name, row_key)
        DO UPDATE
           SET audit_event_id = EXCLUDED.audit_event_id;

        SELECT ARRAY(
            SELECT key
            FROM jsonb_each(v_old) o
            JOIN jsonb_each(v_new) n USING (key)
            WHERE o.value IS DISTINCT FROM n.value
            ORDER BY key
        )
        INTO v_changed_columns;

        PERFORM fn_olius_write_audit_snapshot(
            TG_TABLE_NAME,
            v_old,
            'UPDATE'::operation_status_t,
            'BEFORE'::audit_snapshot_t,
            v_event_id,
            COALESCE(v_changed_columns, ARRAY[]::TEXT[])
        );

        RETURN NEW;
    END IF;


    /*
    UPDATE — AFTER
    */
    IF TG_OP = 'UPDATE' AND TG_WHEN = 'AFTER' THEN

        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_row_key := fn_olius_audit_row_key(TG_RELID, v_old);

        CREATE TEMP TABLE IF NOT EXISTS pg_temp.olius_audit_events (
            table_name TEXT NOT NULL,
            row_key TEXT NOT NULL,
            audit_event_id UUID NOT NULL,
            PRIMARY KEY (table_name, row_key)
        ) ON COMMIT DELETE ROWS;

        SELECT audit_event_id
          INTO v_event_id
          FROM pg_temp.olius_audit_events
         WHERE table_name = TG_TABLE_NAME
           AND row_key = v_row_key;

        IF v_event_id IS NULL THEN
            RAISE EXCEPTION
                'Audit event não encontrado para UPDATE em %. Chave: %.',
                TG_TABLE_NAME,
                v_row_key;
        END IF;

        SELECT ARRAY(
            SELECT key
            FROM jsonb_each(v_old) o
            JOIN jsonb_each(v_new) n USING (key)
            WHERE o.value IS DISTINCT FROM n.value
            ORDER BY key
        )
        INTO v_changed_columns;

        PERFORM fn_olius_write_audit_snapshot(
            TG_TABLE_NAME,
            v_new,
            'UPDATE'::operation_status_t,
            'AFTER'::audit_snapshot_t,
            v_event_id,
            COALESCE(v_changed_columns, ARRAY[]::TEXT[])
        );

        DELETE FROM pg_temp.olius_audit_events
        WHERE table_name = TG_TABLE_NAME
          AND row_key = v_row_key;

        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'Operação/timing não suportado pela auditoria: %.%',
        TG_OP,
        TG_WHEN;
END;
$$;

-- ============================================================================
-- 2. FUNCTION DE TRIGGER — updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_olius_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. FUNCTION DE TRIGGER — SINCRONIZAÇÃO establishment.is_pev
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_olius_sync_establishment_is_pev()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.establishment_id IS DISTINCT FROM NEW.establishment_id
       AND OLD.establishment_id IS NOT NULL THEN

        UPDATE establishment e
           SET is_pev = EXISTS (
               SELECT 1
               FROM pev p
               WHERE p.establishment_id = e.id
                 AND p.status = 'APPROVED'
           )
         WHERE e.id = OLD.establishment_id;
    END IF;


    IF TG_OP = 'DELETE' THEN

        IF OLD.establishment_id IS NOT NULL THEN
            UPDATE establishment e
               SET is_pev = EXISTS (
                   SELECT 1
                   FROM pev p
                   WHERE p.establishment_id = e.id
                     AND p.status = 'APPROVED'
               )
             WHERE e.id = OLD.establishment_id;
        END IF;

        RETURN OLD;
    END IF;


    IF NEW.establishment_id IS NOT NULL THEN
        UPDATE establishment e
           SET is_pev = EXISTS (
               SELECT 1
               FROM pev p
               WHERE p.establishment_id = e.id
                 AND p.status = 'APPROVED'
           )
         WHERE e.id = NEW.establishment_id;
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. REMOÇÃO IDEMPOTENTE DOS TRIGGERS DESTA VERSÃO
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT event_object_table, trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name IN (
              'trg_olius_audit_insert',
              'trg_olius_audit_update_before',
              'trg_olius_audit_update_after',
              'trg_olius_audit_delete',
              'trg_olius_set_updated_at',
              'trg_olius_sync_establishment_is_pev'
          )
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON public.%I',
            r.trigger_name,
            r.event_object_table
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- 5. AUDITORIA — AS 22 TABELAS COM *_log NA ESTRUTURA ATUAL
-- ============================================================================

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'users',
        'addresses',
        'user_qr_code',
        'citizens',
        'establishment',
        'pev',
        'subscription_plan',
        'establishment_subscription',
        'subscription_cycle',
        'billing_order',
        'billing_charge',
        'payment',
        'payment_application',
        'payment_refund',
        'collection_request',
        'collection',
        'collection_failure_reason',
        'collection_failure',
        'delivery_pev',
        'point_calculation',
        'certificate_level',
        'certificate'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_olius_audit_insert
             AFTER INSERT ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION fn_olius_audit_trigger()',
            v_table
        );

        EXECUTE format(
            'CREATE TRIGGER trg_olius_audit_update_before
             BEFORE UPDATE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION fn_olius_audit_trigger()',
            v_table
        );

        EXECUTE format(
            'CREATE TRIGGER trg_olius_audit_update_after
             AFTER UPDATE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION fn_olius_audit_trigger()',
            v_table
        );

        EXECUTE format(
            'CREATE TRIGGER trg_olius_audit_delete
             BEFORE DELETE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION fn_olius_audit_trigger()',
            v_table
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- 6. updated_at — TABELAS DEFINIDAS PELO SCRIPT 02
-- ============================================================================

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'users',
        'pev',
        'subscription_plan',
        'establishment_subscription',
        'subscription_cycle',
        'billing_order',
        'billing_charge',
        'certificate_level',
        'certificate'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_olius_set_updated_at
             BEFORE UPDATE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION fn_olius_set_updated_at()',
            v_table
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- 7. updated_at — OUTRAS TABELAS COM CAMPO updated_at
-- ============================================================================

CREATE TRIGGER trg_olius_set_updated_at
BEFORE UPDATE ON public.collection_request
FOR EACH ROW
EXECUTE FUNCTION fn_olius_set_updated_at();


CREATE TRIGGER trg_olius_set_updated_at
BEFORE UPDATE ON public.driver
FOR EACH ROW
EXECUTE FUNCTION fn_olius_set_updated_at();


CREATE TRIGGER trg_olius_set_updated_at
BEFORE UPDATE ON public.user_qr_code
FOR EACH ROW
EXECUTE FUNCTION fn_olius_set_updated_at();


-- ============================================================================
-- 8. PEV -> establishment.is_pev
-- ============================================================================

CREATE TRIGGER trg_olius_sync_establishment_is_pev
AFTER INSERT OR UPDATE OR DELETE ON public.pev
FOR EACH ROW
EXECUTE FUNCTION fn_olius_sync_establishment_is_pev();


-- ============================================================================
-- 9. COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION fn_olius_audit_trigger()
IS 'Auditoria genérica: INSERT=AFTER, UPDATE=BEFORE+AFTER, DELETE=BEFORE.';

COMMENT ON FUNCTION fn_olius_set_updated_at()
IS 'Atualiza updated_at automaticamente em alterações do registro.';

COMMENT ON FUNCTION fn_olius_sync_establishment_is_pev()
IS 'Mantém establishment.is_pev derivado dos PEVs APPROVED na mesma transação.';


-- ============================================================================
-- 10. CONSULTAS DE CONFERÊNCIA
-- ============================================================================

SELECT
    event_object_table,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_olius_%'
ORDER BY event_object_table, trigger_name;


/*
Conferir auditoria:
*/
-- SELECT * FROM collection_log ORDER BY performed_at DESC;
-- SELECT * FROM collection_request_log ORDER BY performed_at DESC;
-- SELECT * FROM delivery_pev_log ORDER BY performed_at DESC;
-- SELECT * FROM point_calculation_log ORDER BY performed_at DESC;


/*
Conferir pares BEFORE/AFTER de UPDATE:
*/
-- SELECT
--     audit_event_id,
--     operation,
--     snapshot_kind,
--     performed_at,
--     changed_columns
-- FROM collection_log
-- WHERE operation = 'UPDATE'
-- ORDER BY performed_at DESC;


/*
Conferir saldo derivado:
*/
-- SELECT id, points FROM citizens;
-- SELECT id, points, is_pev FROM establishment;


/*
Exemplo de contexto de auditoria dentro de uma TRANSAÇÃO:

BEGIN;

SELECT set_config('app.audit_actor', 'USER', true);
SELECT set_config('app.current_user_id', 'UUID_DO_USUARIO', true);
SELECT set_config('app.audit_reason', 'Atualização solicitada pelo usuário', true);

-- operação...

COMMIT;

Para formulário operacional de motorista:

BEGIN;

SELECT set_config('app.audit_actor', 'DRIVER_FORM', true);
SELECT set_config('app.current_user_id', '', true);
SELECT set_config('app.operational_driver_id', 'UUID_DO_MOTORISTA', true);
SELECT set_config('app.audit_reason', 'Registro operacional da coleta', true);

-- operação...

COMMIT;
*/


/*
===============================================================================
FIM DO SCRIPT 05
===============================================================================
*/
