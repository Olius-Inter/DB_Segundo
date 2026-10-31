/* Sprint 10 — leitura restrita do histórico operacional B2B.
SQL comum, sem includes: executar inteiro no banco escolhido, fora de transação.
Pré-requisitos: 01–08 atuais, catálogo e access_control instalados. Não reexecutar
01–03. Implantador sem SUPERUSER precisa ser dono do schema (ou ter GRANT OPTION
em CREATE), poder SET ROLE olius_business_owner e alterar a função preexistente.
Reaplicável, sem alterações em dados ou contextos app.*. Em erro: ROLLBACK.
CREATE/REVOKE/OWNER/SECURITY/GRANT tornam-se visíveis juntos no COMMIT.
*/
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
DO $preflight$
DECLARE p RECORD;
BEGIN
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='olius_business_owner' AND
        (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
        RAISE EXCEPTION 'Atributos incompatíveis do proprietário interno.' USING ERRCODE='42501';
    END IF;
    IF NOT pg_has_role(current_user,'olius_business_owner','SET')
       OR to_regclass('public.collection_log') IS NULL
       OR to_regclass('public.collection_failure_log') IS NULL THEN
        RAISE EXCEPTION 'Instalação ou privilégios prévios incompatíveis.' USING ERRCODE='42501';
    END IF;
    IF has_schema_privilege('olius_business_owner','public','CREATE') THEN
        RAISE EXCEPTION 'Owner interno com CREATE inesperado: revisar antes da migração.' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_collection_revision_history')>1 THEN
        RAISE EXCEPTION 'Sobrecarga não revisada de get_collection_revision_history.';
    END IF;
    IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_collection_revision_history')
       AND to_regprocedure('public.get_collection_revision_history(uuid,uuid,integer,integer)') IS NULL THEN
        RAISE EXCEPTION 'Assinatura preexistente incompatível.';
    END IF;
    SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.get_collection_revision_history(uuid,uuid,integer,integer)');
    IF FOUND AND (p.proowner<>'olius_business_owner'::regrole OR EXISTS(
        SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.privilege_type='EXECUTE' AND a.grantee NOT IN (p.proowner,'olius_api'::regrole))) THEN
        RAISE EXCEPTION 'Propriedade/EXECUTE preexistentes não revisados.' USING ERRCODE='42501';
    END IF;
END $preflight$;
-- Criação transacional: planejar janela de implantação se os logs forem grandes.
CREATE INDEX IF NOT EXISTS idx_collection_failure_log_revision_window
    ON public.collection_failure_log (collection_id, performed_at);
DO $index_contract$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
        JOIN pg_am a ON a.oid=c.relam
        WHERE i.indexrelid='public.idx_collection_failure_log_revision_window'::regclass
        AND i.indrelid='public.collection_failure_log'::regclass AND i.indisvalid AND NOT i.indisunique
        AND i.indnatts=2 AND i.indnkeyatts=2 AND i.indpred IS NULL AND i.indexprs IS NULL AND a.amname='btree'
        AND pg_get_indexdef(i.indexrelid,1,TRUE)='collection_id'
        AND pg_get_indexdef(i.indexrelid,2,TRUE)='performed_at') THEN
        RAISE EXCEPTION 'Índice preexistente incompatível com a consulta histórica.' USING ERRCODE='55000';
    END IF;
END $index_contract$;
-- Consulta operacional; cálculos e transações de pontos têm contrato separado.
CREATE OR REPLACE FUNCTION public.get_collection_revision_history(
    p_collection_id UUID,
    p_admin_id UUID,
    p_page INTEGER DEFAULT 0,
    p_size INTEGER DEFAULT 20
)
RETURNS TABLE (
    page INTEGER, size INTEGER, total_elements BIGINT,
    collection_id UUID, revision INTEGER, record_status public.record_status_t,
    collected_volume_liters NUMERIC, presented_volume_liters NUMERIC,
    oil_condition public.oil_condition_t, has_compromising_occurrence BOOLEAN,
    result public.collection_result_t, observation TEXT,
    failure_reason_ids UUID[], failure_reason_codes TEXT[],
    collection_request_id UUID, establishment_id UUID, driver_id UUID,
    collection_date TIMESTAMPTZ, recorded_at TIMESTAMPTZ, changed_at TIMESTAMPTZ,
    corrected_at TIMESTAMPTZ, corrected_by UUID, correction_reason TEXT,
    actor_kind public.audit_actor_t, performed_by UUID,
    operational_driver_id UUID, audit_reason TEXT, audit_event_id UUID
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
    c_invalid CONSTANT TEXT := '22023';
    c_history CONSTANT TEXT := '55000';
    c_history_message CONSTANT TEXT := 'Histórico operacional ausente, incompleto ou temporalmente ambíguo.';
    v_current public.collection%ROWTYPE;
    v_rows public.collection_log[];
    v_row public.collection_log%ROWTYPE;
    v_before public.collection_log%ROWTYPE;
    v_previous public.collection_log%ROWTYPE;
    v_end TIMESTAMPTZ;
    v_previous_ids UUID[] := ARRAY[]::UUID[];
    v_ids UUID[];
    v_deleted UUID[];
    v_reasons JSONB[] := ARRAY[]::JSONB[];
    v_insert_count BIGINT;
    v_delete_count BIGINT;
    v_seen BIGINT := 0;
    v_total INTEGER;
    v_last BIGINT;
    v_first INTEGER;
    i INTEGER;
BEGIN
    IF p_collection_id IS NULL OR p_admin_id IS NULL OR p_page IS NULL OR p_page<0
       OR p_size IS NULL OR p_size<1 OR p_size>100 THEN
        RAISE EXCEPTION 'Informe coleta, ADMIN, página >= 0 e tamanho entre 1 e 100.' USING ERRCODE=c_invalid;
    END IF;
    -- UUID recebido não é autenticação: a Core deve obtê-lo do principal validado.
    IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_admin_id
        AND u.user_type='ADMIN' AND u.status='ACTIVE') THEN
        RAISE EXCEPTION 'ADMIN inexistente, inativo ou sem perfil autorizado.' USING ERRCODE='42501';
    END IF;
    SELECT c.* INTO v_current FROM public.collection c WHERE c.id=p_collection_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Coleta inexistente.' USING ERRCODE='P0002'; END IF;

    -- Somente o INSERT e os UPDATEs que incrementaram revision iniciam um estado.
    -- Atualizações de points_earned não criam uma revisão operacional fictícia.
    SELECT array_agg(l ORDER BY l.revision,l.audit_event_id) INTO v_rows
    FROM public.collection_log l WHERE l.id=p_collection_id AND l.snapshot_kind='AFTER'
        AND (l.operation='INSERT' OR (l.operation='UPDATE' AND 'revision'=ANY(l.changed_columns)));
    v_total:=COALESCE(cardinality(v_rows),0);
    IF v_total=0 OR v_total<>v_current.revision THEN
        RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
    END IF;
    IF EXISTS(SELECT 1 FROM public.collection_log l WHERE l.id=p_collection_id
        AND (l.operation='DELETE' OR (l.operation='UPDATE' AND l.snapshot_kind='AFTER'
             AND NOT ('revision'=ANY(l.changed_columns))
             AND NOT (l.changed_columns <@ ARRAY['points_earned']::TEXT[]))))
       OR EXISTS(SELECT 1 FROM public.collection_failure_log f WHERE f.collection_id=p_collection_id
        AND NOT ((f.operation='INSERT' AND f.snapshot_kind='AFTER')
                 OR (f.operation='DELETE' AND f.snapshot_kind='BEFORE'))) THEN
        RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
    END IF;

    FOR i IN 1..v_total LOOP
        v_row:=v_rows[i];
        IF v_row.revision<>i OR (i=1 AND v_row.operation<>'INSERT')
           OR (i>1 AND v_row.operation<>'UPDATE') THEN
            RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
        END IF;
        IF i>1 THEN
            -- audit_event_id é a ligação confiável entre BEFORE e AFTER.
            SELECT b.* INTO v_before FROM public.collection_log b
            WHERE b.id=p_collection_id AND b.audit_event_id=v_row.audit_event_id
                AND b.operation='UPDATE' AND b.snapshot_kind='BEFORE';
            IF NOT FOUND OR v_before.revision<>i-1
               OR v_before.performed_at<v_previous.performed_at
               OR v_row.performed_at<v_before.performed_at
               OR ROW(v_before.record_status,v_before.collected_volume_liters,
                    v_before.presented_volume_liters,v_before.oil_condition,
                    v_before.has_compromising_occurrence,v_before.result,v_before.observation,
                    v_before.collection_date,v_before.driver_id,v_before.collection_request_id,
                    v_before.establishment_id,v_before.created_at)
                  IS DISTINCT FROM ROW(v_previous.record_status,v_previous.collected_volume_liters,
                    v_previous.presented_volume_liters,v_previous.oil_condition,
                    v_previous.has_compromising_occurrence,v_previous.result,v_previous.observation,
                    v_previous.collection_date,v_previous.driver_id,v_previous.collection_request_id,
                    v_previous.establishment_id,v_previous.created_at) THEN
                RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
            END IF;
        END IF;
        v_end:=NULL;
        IF i<v_total THEN
            SELECT b.performed_at INTO v_end FROM public.collection_log b
            WHERE b.id=p_collection_id AND b.audit_event_id=(v_rows[i+1]).audit_event_id
                AND b.operation='UPDATE' AND b.snapshot_kind='BEFORE';
            IF NOT FOUND OR v_end<v_row.performed_at THEN
                RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
            END IF;
        END IF;
        -- correct_collection grava o novo estado ANTES de apagar/reinserir motivos.
        -- INSERTs nesta janela descrevem esta revisão; DELETEs removem a anterior.
        SELECT COALESCE(array_agg(DISTINCT f.failure_reason_id ORDER BY f.failure_reason_id)
                    FILTER(WHERE f.operation='INSERT'),ARRAY[]::UUID[]),
               COALESCE(array_agg(DISTINCT f.failure_reason_id ORDER BY f.failure_reason_id)
                    FILTER(WHERE f.operation='DELETE'),ARRAY[]::UUID[]),
               count(*) FILTER(WHERE f.operation='INSERT'),count(*) FILTER(WHERE f.operation='DELETE')
        INTO v_ids,v_deleted,v_insert_count,v_delete_count
        FROM public.collection_failure_log f WHERE f.collection_id=p_collection_id
            AND f.performed_at>v_row.performed_at AND (v_end IS NULL OR f.performed_at<v_end);
        IF v_insert_count<>cardinality(v_ids) OR v_delete_count<>cardinality(v_deleted)
           OR v_deleted IS DISTINCT FROM v_previous_ids
           OR (v_row.record_status='RECORDED' AND v_row.result='UNSUCCESSFUL' AND cardinality(v_ids)=0)
           OR ((v_row.record_status='ANNULLED' OR v_row.result='SUCCESSFUL') AND cardinality(v_ids)>0) THEN
            RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
        END IF;
        v_seen:=v_seen+v_insert_count+v_delete_count;
        v_reasons[i]:=to_jsonb(v_ids);
        v_previous_ids:=v_ids;
        v_previous:=v_row;
    END LOOP;
    -- Eventos fora das janelas, nos limites ou com lacunas não são adivinhados.
    IF v_seen<>(SELECT count(*) FROM public.collection_failure_log f WHERE f.collection_id=p_collection_id)
       OR v_previous_ids IS DISTINCT FROM (SELECT COALESCE(array_agg(f.failure_reason_id ORDER BY f.failure_reason_id),ARRAY[]::UUID[])
            FROM public.collection_failure f WHERE f.collection_id=p_collection_id)
       OR ROW(v_previous.record_status,v_previous.collected_volume_liters,v_previous.presented_volume_liters,
            v_previous.oil_condition,v_previous.has_compromising_occurrence,v_previous.result,v_previous.observation,
            v_previous.collection_date,v_previous.driver_id,v_previous.collection_request_id,v_previous.establishment_id)
          IS DISTINCT FROM ROW(v_current.record_status,v_current.collected_volume_liters,v_current.presented_volume_liters,
            v_current.oil_condition,v_current.has_compromising_occurrence,v_current.result,v_current.observation,
            v_current.collection_date,v_current.driver_id,v_current.collection_request_id,v_current.establishment_id) THEN
        RAISE EXCEPTION '%',c_history_message USING ERRCODE=c_history;
    END IF;
    page:=p_page; size:=p_size; total_elements:=v_total; collection_id:=p_collection_id;
    v_last:=v_total-p_page::BIGINT*p_size;
    IF v_last<1 THEN
        -- Uma linha de metadados, revision NULL: não é um item do histórico.
        RETURN NEXT;
        RETURN;
    END IF;
    v_first:=GREATEST(1,v_last-p_size+1)::INTEGER;
    FOR i IN REVERSE v_last::INTEGER..v_first LOOP
        v_row:=v_rows[i];
        revision:=v_row.revision; record_status:=v_row.record_status;
        collected_volume_liters:=v_row.collected_volume_liters;
        presented_volume_liters:=v_row.presented_volume_liters;
        oil_condition:=v_row.oil_condition; has_compromising_occurrence:=v_row.has_compromising_occurrence;
        result:=v_row.result; observation:=v_row.observation;
        failure_reason_ids:=ARRAY(SELECT a.value::UUID FROM jsonb_array_elements_text(v_reasons[i]) a(value));
        -- IDs são históricos. Códigos são apenas rótulos atuais, não snapshots do catálogo.
        SELECT COALESCE(array_agg(r.code::TEXT ORDER BY a.position),ARRAY[]::TEXT[])
        INTO failure_reason_codes FROM unnest(failure_reason_ids) WITH ORDINALITY a(id,position)
        LEFT JOIN public.collection_failure_reason r ON r.id=a.id;
        collection_request_id:=v_row.collection_request_id; establishment_id:=v_row.establishment_id;
        driver_id:=v_row.driver_id; collection_date:=v_row.collection_date; recorded_at:=v_row.created_at;
        changed_at:=v_row.performed_at; corrected_at:=v_row.corrected_at;
        corrected_by:=v_row.corrected_by; correction_reason:=v_row.correction_reason;
        actor_kind:=v_row.actor_kind; performed_by:=v_row.performed_by;
        operational_driver_id:=v_row.operational_driver_id; audit_reason:=v_row.audit_reason;
        audit_event_id:=v_row.audit_event_id;
        RETURN NEXT;
    END LOOP;
END $$;
COMMENT ON FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) IS
'Histórico operacional B2B exclusivo de ADMIN ativo: revisões, motivos históricos e paginação; erro 55000 se auditoria insuficiente. Sem cálculos nem snapshots brutos.';
REVOKE ALL ON FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) FROM PUBLIC;

DO $no_external_execute$
DECLARE p RECORD;
BEGIN
    SELECT * INTO STRICT p FROM pg_proc
    WHERE oid='public.get_collection_revision_history(uuid,uuid,integer,integer)'::regprocedure;
    IF EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.privilege_type='EXECUTE' AND a.grantee NOT IN (p.proowner,'olius_api'::regrole,'olius_business_owner'::regrole)) THEN
        RAISE EXCEPTION 'EXECUTE herdado de privilégios padrão não revisados; migração revertida.' USING ERRCODE='42501';
    END IF;
END $no_external_execute$;
GRANT CREATE ON SCHEMA public TO olius_business_owner;
ALTER FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) OWNER TO olius_business_owner;
ALTER FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) SECURITY DEFINER;
ALTER FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) FROM PUBLIC,olius_api,olius_owner RESTRICT;
GRANT EXECUTE ON FUNCTION public.get_collection_revision_history(UUID,UUID,INTEGER,INTEGER) TO olius_api;
REVOKE CREATE ON SCHEMA public FROM olius_business_owner;
DO $validate$
DECLARE consumer TEXT;
BEGIN
    FOREACH consumer IN ARRAY ARRAY['olius_api','olius_core_api'] LOOP
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=consumer) AND (
            has_any_column_privilege(consumer,'public.collection_log','SELECT')
            OR has_any_column_privilege(consumer,'public.collection_failure_log','SELECT')) THEN
            RAISE EXCEPTION 'Consumidor % já tem leitura indevida dos logs; revisar controle de acesso.',consumer USING ERRCODE='42501';
        END IF;
    END LOOP;
    FOREACH consumer IN ARRAY ARRAY['olius_owner','olius_reader','olius_auditor','olius_catalog_editor',
        'olius_ranking_reader','olius_redis_api','olius_bi_reader_role','olius_bi_refresh_role','olius_dm_owner'] LOOP
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=consumer) AND
            has_function_privilege(consumer,'public.get_collection_revision_history(uuid,uuid,integer,integer)','EXECUTE') THEN
            RAISE EXCEPTION 'Consumidor % herda EXECUTE não autorizado; revisar memberships.',consumer USING ERRCODE='42501';
        END IF;
    END LOOP;
END $validate$;
COMMIT;
-- Conferência pós-aplicação; não requer coleta real nem altera dados.
SELECT p.oid::regprocedure AS routine,pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef,p.provolatile,p.proconfig,
       has_function_privilege('olius_api',p.oid,'EXECUTE') AS api_execute
FROM pg_proc p WHERE p.oid='public.get_collection_revision_history(uuid,uuid,integer,integer)'::regprocedure;
SELECT has_any_column_privilege('olius_api','public.collection_log','SELECT') AS api_reads_collection_log,
       has_any_column_privilege('olius_api','public.collection_failure_log','SELECT') AS api_reads_failure_log;
