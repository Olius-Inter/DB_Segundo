/* OLIUS — recuperação de senha. Executar INTEIRO, fora de outra transação.
Pré-requisitos: scripts 01–08, catálogo e access_control da referência anterior.
Core em manutenção: assinatura antiga removida sem CASCADE. Nenhum dado real criado.
O ENUM é aditivo e confirmado antes da transação principal (restrição PostgreSQL).
Se o bloco principal falhar, ROLLBACK; o rótulo inofensivo pode permanecer.
Implantador: dono dos objetos, autoridade nas roles internas; sem SUPERUSER.
*/
BEGIN;
ALTER TYPE public.auth_revocation_reason_t ADD VALUE IF NOT EXISTS 'PASSWORD_RESET';
COMMIT;
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
-- PASSWORD_RESET: tokens próprios, sem segredo original ou histórico de senhas.
CREATE TABLE public.password_reset_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash BYTEA NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    CONSTRAINT uq_password_reset_hash UNIQUE(token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY(user_id) REFERENCES public.users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);
COMMENT ON TABLE public.password_reset_token IS 'Hashes SHA-256 de recuperação; uso único, limites por conta e invalidação conjunta no sucesso. Sem limpeza automática.';
COMMENT ON COLUMN public.password_reset_token.id IS 'Identidade interna da emissão; não é o segredo entregue por e-mail.';
COMMENT ON COLUMN public.password_reset_token.user_id IS 'Conta destinatária; apenas contas ACTIVE podem emitir/concluir.';
COMMENT ON COLUMN public.password_reset_token.token_hash IS 'SHA-256 de 32 bytes; nunca copiar para logs ou respostas HTTP.';
COMMENT ON COLUMN public.password_reset_token.issued_at IS 'Relógio do servidor obtido após o bloqueio da conta; base da janela móvel.';
COMMENT ON COLUMN public.password_reset_token.expires_at IS 'Prazo congelado da emissão; padrão de 30 minutos, informado pela Core.';
COMMENT ON COLUMN public.password_reset_token.consumed_at IS 'Conclusão bem-sucedida, dentro do prazo. Terminal e exclusivo de invalidated_at.';
COMMENT ON COLUMN public.password_reset_token.invalidated_at IS 'Invalidação por outra recuperação concluída; pode atingir tokens já expirados.';

-- Auditoria limitada aos metadados da emissão e às transições, sem token_hash.
CREATE TABLE public.password_reset_token_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    audit_event_id UUID NOT NULL,
    snapshot_kind public.audit_snapshot_t NOT NULL,
    operation public.operation_status_t NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL,
    performed_by UUID,
    actor_kind public.audit_actor_t NOT NULL,
    operational_driver_id UUID,
    audit_reason TEXT,
    changed_columns TEXT[] NOT NULL,
    CONSTRAINT uq_password_reset_log_snapshot UNIQUE(audit_event_id,id,snapshot_kind)
);
COMMENT ON TABLE public.password_reset_token_log IS 'Auditoria de emissão, consumo e invalidação. Não possui hash de token ou senha; eventos públicos usam SYSTEM.';
-- O relógio atual é avaliado pelas rotinas, nunca por CHECK.
ALTER TABLE public.password_reset_token
    ADD CONSTRAINT ck_password_reset_hash CHECK(octet_length(token_hash)=32),
    ADD CONSTRAINT ck_password_reset_dates CHECK(
        isfinite(issued_at) AND isfinite(expires_at) AND expires_at>issued_at
        AND (consumed_at IS NULL OR (isfinite(consumed_at) AND consumed_at>=issued_at AND consumed_at<expires_at))
        AND (invalidated_at IS NULL OR (isfinite(invalidated_at) AND invalidated_at>=issued_at))),
    ADD CONSTRAINT ck_password_reset_terminal CHECK(NOT(consumed_at IS NOT NULL AND invalidated_at IS NOT NULL));
ALTER TABLE public.password_reset_token_log
    ADD CONSTRAINT ck_password_reset_log_snapshot CHECK(
        (operation='INSERT' AND snapshot_kind='AFTER') OR operation='UPDATE'),
    ADD CONSTRAINT ck_password_reset_log_actor CHECK(
        actor_kind='SYSTEM' AND performed_by IS NULL AND operational_driver_id IS NULL),
    ADD CONSTRAINT ck_password_reset_log_date CHECK(isfinite(performed_at));
-- A chave inicial atende FK, invalidação por conta e janela móvel de emissões.
CREATE INDEX idx_password_reset_user_issued ON public.password_reset_token(user_id,issued_at DESC);
CREATE INDEX idx_password_reset_log_history ON public.password_reset_token_log(id,performed_at DESC);

-- Lookup preserva caixa local e normaliza só domínio; UNIQUE(email) não indexa essas expressões.
CREATE INDEX idx_users_password_reset_email ON public.users
    ((split_part(email,'@',1)),(lower(split_part(email,'@',2))));

-- Sem CASCADE: dependências locais desconhecidas devem interromper a migração.
DROP FUNCTION IF EXISTS public.open_auth_session(UUID,BYTEA);
CREATE OR REPLACE FUNCTION public.open_auth_session(p_user_id UUID, p_token_hash BYTEA, p_expected_password_hash TEXT)
RETURNS TABLE (result_code TEXT, session_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_user RECORD; v_now TIMESTAMPTZ; v_expiry TIMESTAMPTZ; v_id UUID;
        v_login_context JSONB;
BEGIN
    SELECT jsonb_object_agg(setting_name, current_setting(setting_name, true)) INTO v_login_context
    FROM unnest(ARRAY['app.audit_actor', 'app.current_user_id',
                      'app.operational_driver_id', 'app.audit_reason']) AS settings(setting_name);
    <<session_operation>>
    BEGIN
        PERFORM set_config(setting_name, setting_value, true)
        FROM (VALUES ('app.audit_actor', 'SYSTEM'), ('app.current_user_id', ''),
                     ('app.operational_driver_id', ''), ('app.audit_reason', '')) AS settings(setting_name, setting_value);
        IF p_token_hash IS NULL OR octet_length(p_token_hash) <> 32
           OR p_expected_password_hash IS NULL OR btrim(p_expected_password_hash)='' THEN
            RETURN QUERY SELECT 'INVALID_INPUT'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ; EXIT session_operation;
        END IF;
        SELECT u.id, u.status, u.user_type, u.password_hash INTO v_user FROM public.users u
        WHERE u.id = p_user_id FOR UPDATE;
        IF NOT FOUND OR v_user.status <> 'ACTIVE'::public.active_status_t THEN
            RETURN QUERY SELECT 'USER_UNAVAILABLE'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ; EXIT session_operation;
        END IF;
        IF v_user.password_hash IS DISTINCT FROM p_expected_password_hash THEN
            RETURN QUERY SELECT 'CREDENTIAL_CHANGED'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ; EXIT session_operation;
        END IF;
        v_now := clock_timestamp();
        v_expiry := v_now + public.auth_idle_duration(v_user.user_type);
        PERFORM set_config('app.audit_actor', 'USER', true);
        PERFORM set_config('app.current_user_id', p_user_id::TEXT, true);
        PERFORM set_config('app.audit_reason', 'Login autenticado pela Core', true);
        INSERT INTO public.auth_session(user_id, created_at, last_renewed_at, idle_expires_at, updated_at)
        VALUES(p_user_id, v_now, v_now, v_expiry, v_now) RETURNING id INTO v_id;
        INSERT INTO public.auth_refresh_token(session_id, token_hash, generation, issued_at, expires_at)
        VALUES(v_id, p_token_hash, 1, v_now, v_expiry);
        RETURN QUERY SELECT 'OK'::TEXT, v_id, v_expiry;
    END session_operation;
    PERFORM set_config(key, coalesce(value, ''), true) FROM jsonb_each_text(v_login_context);
    RETURN;
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(key, coalesce(value, ''), true) FROM jsonb_each_text(v_login_context);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.open_auth_session(UUID,BYTEA,TEXT) FROM PUBLIC;
-- Funções de escrita: a Core controla COMMIT e só envia o e-mail depois dele.
CREATE OR REPLACE FUNCTION public.issue_password_reset(
    p_email TEXT, p_token_hash BYTEA, p_valid_for INTERVAL DEFAULT INTERVAL '30 minutes')
RETURNS TABLE(result_code TEXT,reset_id UUID,user_id UUID,expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v_uid UUID; v_ids UUID[]; v_now TIMESTAMPTZ; v_expiry TIMESTAMPTZ;
        v_id UUID; v_context JSONB; v_constraint TEXT;
BEGIN
    SELECT jsonb_object_agg(n,current_setting(n,true)) INTO v_context
        FROM unnest(ARRAY['app.audit_actor','app.current_user_id','app.operational_driver_id','app.audit_reason']) n;
    <<reset_operation>>
    BEGIN
        IF p_email IS NULL OR btrim(p_email)='' OR length(p_email)>255
           OR length(p_email)-length(replace(p_email,'@',''))<>1
           OR split_part(p_email,'@',1)='' OR split_part(p_email,'@',2)=''
           OR p_token_hash IS NULL OR octet_length(p_token_hash)<>32
           OR p_valid_for IS NULL OR NOT isfinite(p_valid_for) OR p_valid_for<=INTERVAL '0 seconds' THEN
            RETURN QUERY SELECT 'INVALID_INPUT'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END IF;
        -- Parte local exata; somente domínio normalizado. Ambiguidade falha fechada.
        SELECT array_agg(u.id) INTO v_ids FROM public.users u
        WHERE split_part(u.email,'@',1)=split_part(p_email,'@',1)
          AND lower(split_part(u.email,'@',2))=lower(split_part(p_email,'@',2))
          AND length(u.email)-length(replace(u.email,'@',''))=1;
        IF cardinality(v_ids) IS DISTINCT FROM 1 THEN
            RETURN QUERY SELECT 'USER_UNAVAILABLE'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END IF;
        v_uid:=v_ids[1];
        PERFORM 1 FROM public.users u WHERE u.id=v_uid AND u.status='ACTIVE'
          AND split_part(u.email,'@',1)=split_part(p_email,'@',1)
          AND lower(split_part(u.email,'@',2))=lower(split_part(p_email,'@',2))
          AND length(u.email)-length(replace(u.email,'@',''))=1 FOR UPDATE;
        IF NOT FOUND THEN
            RETURN QUERY SELECT 'USER_UNAVAILABLE'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END IF;
        v_now:=clock_timestamp();
        BEGIN
            v_expiry:=v_now+p_valid_for;
        EXCEPTION WHEN datetime_field_overflow THEN
            RETURN QUERY SELECT 'INVALID_INPUT'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END;
        IF NOT isfinite(v_expiry) OR v_expiry<=v_now THEN
            RETURN QUERY SELECT 'INVALID_INPUT'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END IF;
        IF EXISTS(SELECT 1 FROM public.password_reset_token t WHERE t.user_id=v_uid AND t.issued_at>v_now-INTERVAL '60 seconds')
           OR (SELECT count(*) FROM public.password_reset_token t
               WHERE t.user_id=v_uid AND t.issued_at>v_now-INTERVAL '15 minutes')>=3 THEN
            RETURN QUERY SELECT 'RATE_LIMITED'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END IF;
        PERFORM set_config(n,v,true) FROM (VALUES('app.audit_actor','SYSTEM'),('app.current_user_id',''),
            ('app.operational_driver_id',''),('app.audit_reason','Emissão de recuperação de senha')) settings(n,v);
        BEGIN
            INSERT INTO public.password_reset_token(user_id,token_hash,issued_at,expires_at)
                VALUES(v_uid,p_token_hash,v_now,v_expiry) RETURNING id INTO v_id;
        EXCEPTION WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
            IF v_constraint IS DISTINCT FROM 'uq_password_reset_hash' THEN RAISE; END IF;
            RETURN QUERY SELECT 'HASH_CONFLICT'::TEXT,NULL::UUID,NULL::UUID,NULL::TIMESTAMPTZ; EXIT reset_operation;
        END;
        RETURN QUERY SELECT 'OK'::TEXT,v_id,v_uid,v_expiry;
    END reset_operation;
    PERFORM set_config(key,coalesce(value,''),true) FROM jsonb_each_text(v_context);
    RETURN;
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(key,coalesce(value,''),true) FROM jsonb_each_text(v_context);
    RAISE;
END $$;

CREATE OR REPLACE FUNCTION public.complete_password_reset(p_token_hash BYTEA,p_password_hash TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v_uid UUID; v_user RECORD; v_token public.password_reset_token%ROWTYPE;
        v_now TIMESTAMPTZ; v_result TEXT; v_context JSONB;
BEGIN
    SELECT jsonb_object_agg(n,current_setting(n,true)) INTO v_context
        FROM unnest(ARRAY['app.audit_actor','app.current_user_id','app.operational_driver_id','app.audit_reason']) n;
    <<reset_operation>>
    BEGIN
        IF p_token_hash IS NULL OR octet_length(p_token_hash)<>32 OR p_password_hash IS NULL
           OR btrim(p_password_hash)='' OR length(p_password_hash)>255 THEN
            v_result:='INVALID_INPUT'; EXIT reset_operation;
        END IF;
        -- Descoberta sem lock; todos os caminhos de auth bloqueiam primeiro users.
        SELECT t.user_id INTO v_uid FROM public.password_reset_token t WHERE t.token_hash=p_token_hash;
        IF NOT FOUND THEN v_result:='INVALID_TOKEN'; EXIT reset_operation; END IF;
        SELECT u.status INTO v_user FROM public.users u WHERE u.id=v_uid FOR UPDATE;
        IF NOT FOUND OR v_user.status<>'ACTIVE' THEN v_result:='INVALID_TOKEN'; EXIT reset_operation; END IF;
        SELECT t.* INTO v_token FROM public.password_reset_token t
            WHERE t.token_hash=p_token_hash AND t.user_id=v_uid FOR UPDATE;
        v_now:=clock_timestamp();
        IF NOT FOUND OR v_token.consumed_at IS NOT NULL OR v_token.invalidated_at IS NOT NULL
           OR v_token.expires_at<=v_now THEN v_result:='INVALID_TOKEN'; EXIT reset_operation; END IF;
        PERFORM set_config(n,v,true) FROM (VALUES('app.audit_actor','SYSTEM'),('app.current_user_id',''),
            ('app.operational_driver_id',''),('app.audit_reason','Conclusão de recuperação de senha')) settings(n,v);
        UPDATE public.users SET password_hash=p_password_hash WHERE id=v_uid;
        UPDATE public.password_reset_token SET consumed_at=v_now WHERE id=v_token.id;
        UPDATE public.password_reset_token SET invalidated_at=v_now
            WHERE user_id=v_uid AND id<>v_token.id AND consumed_at IS NULL AND invalidated_at IS NULL;
        UPDATE public.auth_session SET revoked_at=clock_timestamp(),revocation_reason='PASSWORD_RESET'
            WHERE user_id=v_uid AND revoked_at IS NULL;
        v_result:='OK';
    END reset_operation;
    PERFORM set_config(key,coalesce(value,''),true) FROM jsonb_each_text(v_context);
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(key,coalesce(value,''),true) FROM jsonb_each_text(v_context);
    RAISE;
END $$;
REVOKE ALL ON FUNCTION public.issue_password_reset(TEXT,BYTEA,INTERVAL),
    public.complete_password_reset(BYTEA,TEXT) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.fn_olius_password_reset_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
    IF TG_OP IN ('DELETE','TRUNCATE') THEN
        RAISE EXCEPTION 'Histórico de recuperação não pode ser removido.' USING ERRCODE='55000';
    END IF;
    IF ROW(NEW.id,NEW.user_id,NEW.token_hash,NEW.issued_at,NEW.expires_at)
       IS DISTINCT FROM ROW(OLD.id,OLD.user_id,OLD.token_hash,OLD.issued_at,OLD.expires_at)
       OR ((OLD.consumed_at IS NOT NULL OR OLD.invalidated_at IS NOT NULL)
           AND ROW(NEW.consumed_at,NEW.invalidated_at) IS DISTINCT FROM ROW(OLD.consumed_at,OLD.invalidated_at)) THEN
        RAISE EXCEPTION 'Identidade e estados terminais de recuperação são imutáveis.' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fn_olius_password_reset_guard() FROM PUBLIC;
CREATE TRIGGER trg_password_reset_guard BEFORE UPDATE OR DELETE ON public.password_reset_token
    FOR EACH ROW EXECUTE FUNCTION public.fn_olius_password_reset_guard();
CREATE TRIGGER trg_password_reset_no_truncate BEFORE TRUNCATE ON public.password_reset_token
    FOR EACH STATEMENT EXECUTE FUNCTION public.fn_olius_password_reset_guard();
CREATE TRIGGER trg_password_reset_audit AFTER INSERT OR UPDATE ON public.password_reset_token
    FOR EACH ROW EXECUTE FUNCTION public.fn_olius_audit_trigger();

ALTER TABLE public.password_reset_token OWNER TO olius_owner;
ALTER TABLE public.password_reset_token_log OWNER TO olius_owner;
GRANT ALL ON public.password_reset_token,public.password_reset_token_log TO olius_owner;
GRANT CREATE ON SCHEMA public TO olius_auth_owner;
ALTER FUNCTION public.open_auth_session(UUID,BYTEA,TEXT) OWNER TO olius_auth_owner;
REVOKE ALL ON FUNCTION public.open_auth_session(UUID,BYTEA,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_auth_session(UUID,BYTEA,TEXT) TO olius_api,olius_owner;
-- PASSWORD_RESET — owner interno; nenhum segredo disponível à Core por tabela.
REVOKE ALL ON public.password_reset_token, public.password_reset_token_log
    FROM PUBLIC,olius_api,olius_reader,olius_ranking_reader,olius_catalog_editor;
GRANT SELECT,INSERT ON public.password_reset_token TO olius_auth_owner;
GRANT UPDATE (consumed_at,invalidated_at) ON public.password_reset_token TO olius_auth_owner;
GRANT SELECT (email,password_hash),UPDATE (password_hash) ON public.users TO olius_auth_owner;
GRANT INSERT ON public.password_reset_token_log TO olius_business_owner;
GRANT SELECT ON public.password_reset_token_log TO olius_auditor;
GRANT CREATE ON SCHEMA public TO olius_auth_owner;
ALTER FUNCTION public.issue_password_reset(TEXT,BYTEA,INTERVAL) OWNER TO olius_auth_owner;
ALTER FUNCTION public.complete_password_reset(BYTEA,TEXT) OWNER TO olius_auth_owner;
REVOKE ALL ON FUNCTION public.issue_password_reset(TEXT,BYTEA,INTERVAL),public.complete_password_reset(BYTEA,TEXT)
    FROM PUBLIC,olius_api,olius_owner RESTRICT;
GRANT EXECUTE ON FUNCTION public.issue_password_reset(TEXT,BYTEA,INTERVAL),public.complete_password_reset(BYTEA,TEXT) TO olius_api;
-- Falhar fechado em concessões externas, sem revogar direitos de terceiros silenciosamente.
DO $password_reset_routines$
DECLARE r RECORD;
BEGIN
    IF (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace
        AND proname IN ('issue_password_reset','complete_password_reset'))<>2 THEN
        RAISE EXCEPTION 'Sobrecarga de recuperação de senha não revisada.' USING ERRCODE='42501';
    END IF;
    FOR r IN SELECT p.proowner,p.proacl FROM pg_catalog.pg_proc p
        WHERE p.pronamespace='public'::regnamespace
          AND p.proname IN ('issue_password_reset','complete_password_reset') LOOP
        IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(r.proacl,pg_catalog.acldefault('f',r.proowner))) a
            WHERE a.privilege_type='EXECUTE' AND a.grantee NOT IN (r.proowner,'olius_api'::regrole)) THEN
            RAISE EXCEPTION 'Rotina de recuperação de senha tem EXECUTE externo: revisar antes de reaplicar.' USING ERRCODE='42501';
        END IF;
    END LOOP;
END $password_reset_routines$;
REVOKE CREATE ON SCHEMA public FROM olius_auth_owner;
ALTER FUNCTION public.fn_olius_password_reset_guard() OWNER TO olius_owner;
REVOKE ALL ON FUNCTION public.fn_olius_password_reset_guard() FROM PUBLIC,olius_api;
-- Recuperação de senha: metadados apenas; nunca valores das credenciais.
WITH reset_seed(schema_name,table_name,domain_name,description,business_rules,access_policy,access_status,source_reference) AS (VALUES('public','password_reset_token','Autenticação e sessões','Emissões de recuperação de senha independentes de sessões e convites.',
    'Conta ativa; 3 emissões/15 minutos, intervalo mínimo de 60 segundos; consumo único e invalidação das demais no sucesso.',
    'Core somente EXECUTE; olius_auth_owner opera os tokens; leitores, Redis e BI sem acesso.','DEFINED','PASSWORD_RESET.md'),
('public','password_reset_token_log','Auditoria','Metadados auditáveis de emissão, consumo e invalidação, sem hashes.',
    'Eventos públicos SYSTEM sem autor administrativo; BEFORE/AFTER correlacionados no UPDATE.',
    'Somente auditor e manutenção consultam; escrita pela trigger, sem acesso direto da Core.','DEFINED','PASSWORD_RESET.md')
)
INSERT INTO public.data_catalog_table(schema_name,table_name,domain_name,description,business_rules,access_policy,access_status,source_reference)
SELECT s.* FROM reset_seed s JOIN pg_catalog.pg_namespace n ON n.nspname=s.schema_name
JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=s.table_name AND c.relkind IN ('r','p')
ON CONFLICT(schema_name,table_name) DO NOTHING;
INSERT INTO public.data_catalog_column(table_catalog_id,column_name,description,business_rules,documentation_status,source_reference)
SELECT d.id,a.attname,coalesce(col_description(c.oid,a.attnum),CASE a.attname
    WHEN 'log_id' THEN 'Identificador único do snapshot de auditoria.'
    WHEN 'id' THEN 'Identificador interno da emissão de recuperação.'
    WHEN 'user_id' THEN 'Usuário destinatário da recuperação; não comprova autoria.'
    WHEN 'issued_at' THEN 'Instante original da emissão, usado na janela móvel.'
    WHEN 'expires_at' THEN 'Expiração congelada da emissão.'
    WHEN 'consumed_at' THEN 'Instante da recuperação concluída com este token.'
    WHEN 'invalidated_at' THEN 'Instante da invalidação por outra recuperação.'
    WHEN 'audit_event_id' THEN 'Correlação dos snapshots BEFORE/AFTER da mesma alteração.'
    WHEN 'snapshot_kind' THEN 'Estado anterior ou posterior à operação.'
    WHEN 'operation' THEN 'Operação de inserção ou atualização auditada.'
    WHEN 'performed_at' THEN 'Instante de gravação do snapshot.'
    WHEN 'performed_by' THEN 'Nulo em operações públicas de recuperação.'
    WHEN 'actor_kind' THEN 'SYSTEM nas operações públicas de recuperação.'
    WHEN 'operational_driver_id' THEN 'Sempre nulo; motoristas não possuem login.'
    WHEN 'audit_reason' THEN 'Motivo controlado pela rotina; nunca contém segredos.'
    WHEN 'changed_columns' THEN 'Nomes das colunas alteradas, sem seus valores.' END),
    NULL,'DOCUMENTED','PASSWORD_RESET.md; scripts 01–05'
FROM public.data_catalog_table d JOIN pg_namespace n ON n.nspname=d.schema_name
JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=d.table_name
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE d.schema_name='public' AND d.table_name IN ('password_reset_token','password_reset_token_log')
ON CONFLICT(table_catalog_id,column_name) DO NOTHING;

DO $$ BEGIN
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='open_auth_session')<>1
 THEN RAISE EXCEPTION 'Sobrecarga de login não revisada'; END IF;
END $$;
UPDATE public.data_catalog_column c SET description=replace(c.description,
    'LOGOUT, ACCOUNT_INACTIVE ou REFRESH_REUSE',
    'LOGOUT, ACCOUNT_INACTIVE, REFRESH_REUSE ou PASSWORD_RESET')
FROM public.data_catalog_table t WHERE c.table_catalog_id=t.id AND t.schema_name='public'
    AND t.table_name IN ('auth_session','auth_session_log') AND c.column_name='revocation_reason'
    AND position('LOGOUT, ACCOUNT_INACTIVE ou REFRESH_REUSE' IN c.description)>0;
COMMIT;
SELECT to_regprocedure('public.open_auth_session(uuid,bytea)') IS NULL AS old_login_removed,
       has_function_privilege('olius_api','public.open_auth_session(uuid,bytea,text)','EXECUTE') AS new_login_allowed;
