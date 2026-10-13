-- Pré-requisito: scripts principais e data_catalog/01 a 07, em base descartável.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth_test;
CREATE FUNCTION auth_test.assert(ok BOOLEAN, message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION auth_test.error(command TEXT, expected TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE command;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = expected THEN RETURN; END IF;
        RAISE EXCEPTION 'FAIL expected %, got %: %', expected, SQLSTATE, SQLERRM;
    END;
    RAISE EXCEPTION 'FAIL: command unexpectedly succeeded';
END $$;
CREATE TABLE auth_test.sessions(kind TEXT, session_id UUID, expires_at TIMESTAMPTZ);
GRANT USAGE ON SCHEMA auth_test TO olius_api;
GRANT SELECT, INSERT ON auth_test.sessions TO olius_api;
INSERT INTO public.users(id,name,email,password_hash,user_type) VALUES
('10000000-0000-0000-0000-000000000001','Citizen test','authcit@olius.test','test-hash','CITIZENS'),
('10000000-0000-0000-0000-000000000002','Admin test','authadm@olius.test','test-hash','ADMIN'),
('10000000-0000-0000-0000-000000000003','Est test','authest@olius.test','test-hash','ESTABLISHMENT');
SELECT auth_test.assert((SELECT COUNT(*)=55 FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('data_catalog_table','data_catalog_column','data_catalog_role')),'55 application tables');
SELECT auth_test.assert((SELECT COUNT(*)=23 FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%\_log'),'23 logs');

SET LOCAL SESSION AUTHORIZATION olius_api;
INSERT INTO auth_test.sessions SELECT 'citizen', session_id, expires_at
FROM public.open_auth_session('10000000-0000-0000-0000-000000000001',sha256('token1'::bytea));
INSERT INTO auth_test.sessions SELECT 'admin', session_id, expires_at
FROM public.open_auth_session('10000000-0000-0000-0000-000000000002',sha256('token2'::bytea));
INSERT INTO auth_test.sessions SELECT 'est', session_id, expires_at
FROM public.open_auth_session('10000000-0000-0000-0000-000000000003',sha256('token3'::bytea));
INSERT INTO auth_test.sessions SELECT 'second', session_id, expires_at
FROM public.open_auth_session('10000000-0000-0000-0000-000000000001',sha256('token4'::bytea));
SELECT auth_test.assert(result_code='OK','rotation') FROM public.rotate_auth_refresh_token(sha256('token1'::bytea),sha256('token5'::bytea));
SELECT auth_test.assert(is_valid,'valid session') FROM public.get_auth_session_status('10000000-0000-0000-0000-000000000001',(SELECT session_id FROM auth_test.sessions WHERE kind='citizen'));
SELECT auth_test.assert(NOT is_valid,'wrong sub/sid') FROM public.get_auth_session_status('10000000-0000-0000-0000-000000000002',(SELECT session_id FROM auth_test.sessions WHERE kind='citizen'));
SELECT auth_test.assert(result_code='REFRESH_REUSED','reuse result') FROM public.rotate_auth_refresh_token(sha256('token1'::bytea),NULL);
SELECT auth_test.assert(result_code='SESSION_REVOKED','successor rejected after reuse') FROM public.rotate_auth_refresh_token(sha256('token5'::bytea),sha256('token7'::bytea));
SELECT auth_test.assert(result_code='INVALID_TOKEN','unknown token') FROM public.rotate_auth_refresh_token(sha256('unknown'::bytea),sha256('token8'::bytea));
SELECT auth_test.assert(public.revoke_auth_session('10000000-0000-0000-0000-000000000001',(SELECT session_id FROM auth_test.sessions WHERE kind='second'))='OK','logout');
SELECT auth_test.assert(public.revoke_auth_session('10000000-0000-0000-0000-000000000001',(SELECT session_id FROM auth_test.sessions WHERE kind='second'))='ALREADY_REVOKED','logout repeated');
SELECT auth_test.error('SELECT * FROM public.auth_refresh_token','42501');
SELECT auth_test.error('UPDATE public.auth_session SET idle_expires_at=clock_timestamp()','42501');
SELECT auth_test.error('DELETE FROM public.auth_session_log','42501');
SELECT auth_test.error('INSERT INTO public.auth_session_log DEFAULT VALUES','42501');
SELECT auth_test.error('SELECT public.auth_idle_duration(''ADMIN'')','42501');
SELECT auth_test.error('SET ROLE olius_auth_owner','42501');
RESET SESSION AUTHORIZATION;

SELECT auth_test.assert((SELECT bool_and(EXTRACT(EPOCH FROM (s.idle_expires_at-s.last_renewed_at)) = CASE u.user_type WHEN 'ADMIN' THEN 604800 ELSE 1296000 END)
FROM public.auth_session s JOIN public.users u ON u.id=s.user_id),'elapsed TTL');
SELECT auth_test.assert((SELECT COUNT(*)=2 FROM public.auth_refresh_token WHERE session_id=(SELECT session_id FROM auth_test.sessions WHERE kind='citizen')),'two generations');
SELECT auth_test.assert((SELECT bool_and(actor_kind='SYSTEM' AND performed_by IS NULL) FROM public.auth_session_log WHERE revocation_reason='REFRESH_REUSE'),'reuse is SYSTEM');
SELECT auth_test.assert(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='auth_session_log' AND column_name IN ('token_hash','token','access_token')),'no credentials in audit');
SELECT auth_test.assert(COALESCE(current_setting('app.audit_actor',true),'')='','context restored');
SELECT auth_test.error('UPDATE public.auth_refresh_token SET consumed_at=NULL WHERE token_hash=sha256(''token1''::bytea)','55000');
SELECT auth_test.error('UPDATE public.auth_refresh_token SET generation=99 WHERE token_hash=sha256(''token2''::bytea)','55000');
SELECT auth_test.error('DELETE FROM public.auth_refresh_token','55000');
SELECT auth_test.error('TRUNCATE public.auth_refresh_token','55000');
SELECT auth_test.error('UPDATE public.auth_session SET revoked_at=NULL,revocation_reason=NULL WHERE revocation_reason=''REFRESH_REUSE''','55000');
SELECT auth_test.error($q$INSERT INTO public.auth_refresh_token(session_id,token_hash,generation,issued_at,expires_at)
SELECT session_id,sha256('newbad'::bytea),99,clock_timestamp(),clock_timestamp()+INTERVAL '1 hour' FROM auth_test.sessions WHERE kind='admin'$q$,'23505');
SELECT auth_test.error($q$INSERT INTO public.auth_refresh_token(session_id,token_hash,generation,issued_at,expires_at)
SELECT session_id,sha256('token1'::bytea),99,clock_timestamp(),clock_timestamp()+INTERVAL '1 hour' FROM auth_test.sessions WHERE kind='citizen'$q$,'23505');
SELECT auth_test.error($q$INSERT INTO public.auth_refresh_token(session_id,token_hash,generation,issued_at,expires_at,consumed_at)
SELECT session_id,sha256('genbad'::bytea),1,clock_timestamp(),clock_timestamp()+INTERVAL '1 hour',clock_timestamp() FROM auth_test.sessions WHERE kind='admin'$q$,'23505');
SELECT auth_test.error($q$INSERT INTO public.auth_refresh_token(session_id,token_hash,generation,issued_at,expires_at)
SELECT session_id,'short'::bytea,99,clock_timestamp(),clock_timestamp()+INTERVAL '1 hour' FROM auth_test.sessions WHERE kind='admin'$q$,'23514');

-- Falha depois de consumir (hash sucessor duplicado) deve desfazer tudo.
SELECT auth_test.error('SELECT * FROM public.rotate_auth_refresh_token(sha256(''token2''::bytea),sha256(''token3''::bytea))','23505');
SELECT auth_test.assert((SELECT consumed_at IS NULL FROM public.auth_refresh_token WHERE token_hash=sha256('token2'::bytea)),'rollback restores consumption');

-- Inativação preserva autor admin, distinto do titular, e revoga todos os logins.
SELECT set_config('app.audit_actor','USER',true),set_config('app.current_user_id','10000000-0000-0000-0000-000000000002',true);
UPDATE public.users SET status='INACTIVE' WHERE id='10000000-0000-0000-0000-000000000003';
SELECT auth_test.assert((SELECT revocation_reason='ACCOUNT_INACTIVE' FROM public.auth_session WHERE user_id='10000000-0000-0000-0000-000000000003'),'inactive revokes');
SELECT auth_test.assert((SELECT bool_and(performed_by='10000000-0000-0000-0000-000000000002'::UUID AND user_id='10000000-0000-0000-0000-000000000003'::UUID)
FROM public.auth_session_log WHERE revocation_reason='ACCOUNT_INACTIVE'),'author separate from holder');
UPDATE public.users SET status='ACTIVE' WHERE id='10000000-0000-0000-0000-000000000003';
SELECT auth_test.assert(result_code='SESSION_REVOKED','reactivation does not restore session') FROM public.rotate_auth_refresh_token(sha256('token3'::bytea),sha256('newafter'::bytea));
SELECT set_config('app.audit_actor','SYSTEM',true),set_config('app.current_user_id','',true);

-- Fixtures de borda: timestamps passados, sem aguardar 7/15 dias.
INSERT INTO public.auth_session(id,user_id,created_at,last_renewed_at,idle_expires_at,updated_at)
SELECT gen_random_uuid(),id,clock_timestamp()-INTERVAL '400 hours',clock_timestamp()-INTERVAL '400 hours',clock_timestamp(),clock_timestamp()
FROM public.users WHERE email LIKE 'auth%@olius.test';
INSERT INTO public.auth_refresh_token(session_id,token_hash,generation,issued_at,expires_at)
SELECT id,sha256(id::TEXT::bytea),1,last_renewed_at,idle_expires_at FROM public.auth_session WHERE created_at < clock_timestamp()-INTERVAL '399 hours';
DO $$ DECLARE t RECORD; r RECORD; BEGIN
FOR t IN SELECT token_hash FROM public.auth_refresh_token WHERE expires_at<=clock_timestamp() LOOP
    SELECT * INTO r FROM public.rotate_auth_refresh_token(t.token_hash,sha256(gen_random_uuid()::TEXT::bytea));
    PERFORM auth_test.assert(r.result_code='SESSION_EXPIRED','expired cannot renew');
END LOOP; END $$;
SET LOCAL TIME ZONE 'America/New_York';
SELECT auth_test.assert(EXTRACT(EPOCH FROM (TIMESTAMPTZ '2026-03-01 12:00 America/New_York'+public.auth_idle_duration('CITIZENS')-TIMESTAMPTZ '2026-03-01 12:00 America/New_York'))=1296000,'DST 15 days');
SELECT auth_test.assert(EXTRACT(EPOCH FROM (TIMESTAMPTZ '2026-03-05 12:00 America/New_York'+public.auth_idle_duration('ADMIN')-TIMESTAMPTZ '2026-03-05 12:00 America/New_York'))=604800,'DST 7 days');
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT auth_test.assert(revoked_count>=1,'bulk logout') FROM public.revoke_user_auth_sessions('10000000-0000-0000-0000-000000000002');
RESET SESSION AUTHORIZATION;
ROLLBACK;
\echo 'PASS: auth functional, constraints, audit, TTL and olius_api permissions'
