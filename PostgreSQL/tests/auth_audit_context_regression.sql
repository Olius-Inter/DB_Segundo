-- Escopo de autoria em sucesso, retorno antecipado e falha, usando a role da Core.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth_context_test;
CREATE FUNCTION auth_context_test.assert(ok BOOLEAN, message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION auth_context_test.assert_context() RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM auth_context_test.assert(
        current_setting('app.audit_actor',true)='USER'
        AND current_setting('app.current_user_id',true)='12000000-0000-0000-0000-000000000002'
        AND current_setting('app.operational_driver_id',true)='12000000-0000-0000-0000-000000000099'
        AND current_setting('app.audit_reason',true)='Contexto externo preservado', 'quatro valores externos restaurados');
END $$;
CREATE FUNCTION auth_context_test.error(sql TEXT, code TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE sql;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE<>code THEN RAISE; END IF;
        PERFORM auth_context_test.assert_context();
        RETURN;
    END;
    RAISE EXCEPTION 'Esperava erro %',code;
END $$;
CREATE FUNCTION auth_context_test.fail_session() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('auth_context_test.inject_failure',true)='on' THEN
        RAISE EXCEPTION 'Falha transacional simulada' USING ERRCODE='P7001';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_test_session_fault BEFORE INSERT OR UPDATE ON public.auth_session
FOR EACH ROW EXECUTE FUNCTION auth_context_test.fail_session();
GRANT USAGE ON SCHEMA auth_context_test TO olius_api;
INSERT INTO public.users(id,name,email,password_hash,user_type) VALUES
('12000000-0000-0000-0000-000000000001','Titular de contexto','context-owner@olius.test','test','CITIZENS'),
('12000000-0000-0000-0000-000000000002','Autor externo','context-author@olius.test','test','CITIZENS');

SET LOCAL SESSION AUTHORIZATION olius_api;
-- A primeira chamada não herda contexto: vazio/ausente tem a mesma semântica.
SELECT set_config('app.audit_actor','',true),set_config('app.current_user_id','',true),
       set_config('app.operational_driver_id','',true),set_config('app.audit_reason','',true);
SELECT auth_context_test.assert(result_code='OK','login inicial') FROM public.open_auth_session(
    '12000000-0000-0000-0000-000000000001',sha256('context-initial'::bytea));
SELECT auth_context_test.assert(NOT EXISTS(SELECT 1 FROM unnest(ARRAY[
    'app.audit_actor','app.current_user_id','app.operational_driver_id','app.audit_reason']) p
    WHERE coalesce(current_setting(p,true),'')<>''),'contexto vazio restaurado');
-- Motorista externo propositalmente inexistente detecta falta de limpeza antes da auditoria.
SELECT set_config('app.audit_actor','USER',true),
       set_config('app.current_user_id','12000000-0000-0000-0000-000000000002',true),
       set_config('app.operational_driver_id','12000000-0000-0000-0000-000000000099',true),
       set_config('app.audit_reason','Contexto externo preservado',true);

DO $$ DECLARE login RECORD; rotation RECORD; other_login RECORD;
BEGIN
    SELECT * INTO login FROM public.open_auth_session(
        '12000000-0000-0000-0000-000000000001',sha256('context-login'::bytea));
    PERFORM auth_context_test.assert(login.result_code='OK','login normal');
    PERFORM auth_context_test.assert_context();
    SELECT * INTO rotation FROM public.rotate_auth_refresh_token(
        sha256('context-login'::bytea),sha256('context-successor'::bytea));
    PERFORM auth_context_test.assert(rotation.result_code='OK','rotação normal');
    PERFORM auth_context_test.assert_context();
    SELECT * INTO rotation FROM public.rotate_auth_refresh_token(
        sha256('context-login'::bytea),sha256('context-reuse-next'::bytea));
    PERFORM auth_context_test.assert(rotation.result_code='REFRESH_REUSED','reutilização revoga');
    PERFORM auth_context_test.assert_context();
    PERFORM auth_context_test.assert(public.revoke_auth_session(
        '12000000-0000-0000-0000-000000000001',login.session_id)='ALREADY_REVOKED','logout já revogado');
    PERFORM auth_context_test.assert_context();
    SELECT * INTO other_login FROM public.open_auth_session(
        '12000000-0000-0000-0000-000000000001',sha256('context-logout'::bytea));
    PERFORM auth_context_test.assert(public.revoke_auth_session(
        '12000000-0000-0000-0000-000000000001',other_login.session_id)='OK','logout normal');
    PERFORM auth_context_test.assert_context();
    PERFORM auth_context_test.assert(result_code='INVALID_INPUT','login inválido')
        FROM public.open_auth_session(NULL,NULL);
    PERFORM auth_context_test.assert_context();
    PERFORM auth_context_test.assert(result_code='INVALID_INPUT','rotação inválida')
        FROM public.rotate_auth_refresh_token(NULL,NULL);
    PERFORM auth_context_test.assert_context();
    PERFORM auth_context_test.assert(public.revoke_auth_session(NULL,NULL)='INVALID_SESSION','logout inválido');
    PERFORM auth_context_test.assert_context();
    PERFORM auth_context_test.assert(result_code='USER_UNAVAILABLE','logout global inválido')
        FROM public.revoke_user_auth_sessions(NULL);
    PERFORM auth_context_test.assert_context();
END $$;

-- Falhas após a configuração de autoria devem reverter escritas e manter o chamador.
SELECT set_config('auth_context_test.inject_failure','on',true);
SELECT auth_context_test.error($call$SELECT * FROM public.open_auth_session(
 '12000000-0000-0000-0000-000000000001',sha256('context-failed-login'::bytea))$call$,'P7001');
SELECT auth_context_test.error($call$SELECT * FROM public.rotate_auth_refresh_token(
 sha256('context-initial'::bytea),sha256('context-failed-next'::bytea))$call$,'P7001');
SELECT set_config('auth_context_test.inject_failure','off',true);
RESET SESSION AUTHORIZATION;
-- A Core não lê a tabela de sessões: compartilhar somente o id da fixture de teste.
CREATE TABLE auth_context_test.active_session AS SELECT id FROM public.auth_session
WHERE user_id='12000000-0000-0000-0000-000000000001' AND revoked_at IS NULL;
GRANT SELECT ON auth_context_test.active_session TO olius_api;
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT set_config('auth_context_test.inject_failure','on',true);
SELECT auth_context_test.error($call$SELECT public.revoke_auth_session(
 '12000000-0000-0000-0000-000000000001',(SELECT id FROM auth_context_test.active_session LIMIT 1))$call$,'P7001');
SELECT auth_context_test.error($call$SELECT * FROM public.revoke_user_auth_sessions(
 '12000000-0000-0000-0000-000000000001')$call$,'P7001');
SELECT set_config('auth_context_test.inject_failure','off',true);
SELECT auth_context_test.assert(result_code='OK' AND revoked_count>=1,'logout global normal')
FROM public.revoke_user_auth_sessions('12000000-0000-0000-0000-000000000001');
SELECT auth_context_test.assert_context();
RESET SESSION AUTHORIZATION;
SELECT auth_context_test.assert(NOT EXISTS(SELECT 1 FROM public.auth_refresh_token
WHERE token_hash IN (sha256('context-failed-login'::bytea),sha256('context-failed-next'::bytea))), 'falhas sem credenciais parciais');
SELECT auth_context_test.assert((SELECT bool_and(actor_kind='SYSTEM' AND performed_by IS NULL
    AND operational_driver_id IS NULL) FROM public.auth_session_log
    WHERE user_id='12000000-0000-0000-0000-000000000001'
    AND audit_reason='Reutilização de refresh token consumido'),'reuso auditado como SYSTEM');
SELECT auth_context_test.assert((SELECT bool_and(actor_kind='USER'
    AND performed_by='12000000-0000-0000-0000-000000000001'::uuid AND operational_driver_id IS NULL)
    FROM public.auth_session_log WHERE user_id='12000000-0000-0000-0000-000000000001'
    AND audit_reason IN ('Login autenticado pela Core','Rotação válida de refresh token',
                         'Logout autenticado pela Core','Logout das sessões do titular autenticado')),'autor das operações autenticadas');
ROLLBACK;
\echo 'PASS: isolamento da auditoria, retornos antecipados, exceções e chamadas sucessivas'
