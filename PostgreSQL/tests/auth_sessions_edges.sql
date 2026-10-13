-- Casos de rejeição/expiração que não devem criar nem renovar credenciais.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth_edges;
CREATE FUNCTION auth_edges.assert(ok BOOLEAN, message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
GRANT USAGE ON SCHEMA auth_edges TO olius_api;
INSERT INTO users(id,name,email,password_hash,user_type,status) VALUES
('11000000-0000-0000-0000-000000000001','Auth edge active','edgeactive@olius.test','test','CITIZENS','ACTIVE'),
('11000000-0000-0000-0000-000000000002','Auth edge inactive','edgeinactive@olius.test','test','CITIZENS','INACTIVE');
CREATE TABLE auth_edges.session (id UUID);
INSERT INTO auth_edges.session SELECT session_id FROM open_auth_session(
    '11000000-0000-0000-0000-000000000001',sha256('edge-original'::bytea));
GRANT SELECT ON auth_edges.session TO olius_api;
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT auth_edges.assert(result_code='INVALID_INPUT','short hash rejected') FROM open_auth_session(
    '11000000-0000-0000-0000-000000000001','short'::bytea);
SELECT auth_edges.assert(result_code='USER_UNAVAILABLE','unknown user rejected') FROM open_auth_session(
    '11000000-0000-0000-0000-000000000099',sha256('edge-missing'::bytea));
SELECT auth_edges.assert(result_code='USER_UNAVAILABLE','inactive user rejected') FROM open_auth_session(
    '11000000-0000-0000-0000-000000000002',sha256('edge-inactive'::bytea));
SELECT auth_edges.assert(result_code='INVALID_INPUT','invalid old hash') FROM rotate_auth_refresh_token(
    NULL,sha256('edge-next'::bytea));
SELECT auth_edges.assert(result_code='INVALID_INPUT','successor missing') FROM rotate_auth_refresh_token(
    sha256('edge-original'::bytea),NULL);
SELECT auth_edges.assert(result_code='INVALID_INPUT','successor equals predecessor') FROM rotate_auth_refresh_token(
    sha256('edge-original'::bytea),sha256('edge-original'::bytea));
SELECT auth_edges.assert(revoke_auth_session('11000000-0000-0000-0000-000000000099',gen_random_uuid())='INVALID_SESSION','unknown logout user');
SELECT auth_edges.assert(revoke_auth_session('11000000-0000-0000-0000-000000000002',(SELECT id FROM auth_edges.session))='INVALID_SESSION','logout cannot target another owner');
SELECT auth_edges.assert(result_code='USER_UNAVAILABLE' AND revoked_count=0,'bulk logout unknown user') FROM revoke_user_auth_sessions('11000000-0000-0000-0000-000000000099');
RESET SESSION AUTHORIZATION;
SELECT auth_edges.assert((SELECT COUNT(*)=1 AND bool_and(consumed_at IS NULL) FROM auth_refresh_token
    WHERE session_id=(SELECT id FROM auth_edges.session)),'invalid inputs do not consume token');
-- Sessão ainda válida, mas segredo expirado: TOKEN_EXPIRED e nenhuma rotação.
CREATE TABLE auth_edges.expired_session (id UUID DEFAULT gen_random_uuid());
INSERT INTO auth_edges.expired_session DEFAULT VALUES;
INSERT INTO auth_session(id,user_id,created_at,last_renewed_at,idle_expires_at,updated_at)
SELECT id,'11000000-0000-0000-0000-000000000001',clock_timestamp()-INTERVAL '1 hour',
    clock_timestamp()-INTERVAL '1 hour',clock_timestamp()+INTERVAL '1 hour',clock_timestamp()
FROM auth_edges.expired_session;
INSERT INTO auth_refresh_token(session_id,token_hash,generation,issued_at,expires_at)
SELECT id,sha256('edge-expired'::bytea),1,clock_timestamp()-INTERVAL '1 hour',
    clock_timestamp()-INTERVAL '1 second' FROM auth_edges.expired_session;
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT auth_edges.assert(result_code='TOKEN_EXPIRED','expired token in valid session') FROM rotate_auth_refresh_token(
    sha256('edge-expired'::bytea),sha256('edge-next'::bytea));
RESET SESSION AUTHORIZATION;
-- Inativação tem precedência sobre a renovação e não cria sucessor.
UPDATE users SET status='INACTIVE' WHERE id='11000000-0000-0000-0000-000000000001';
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT auth_edges.assert(result_code='USER_INACTIVE','inactive cannot refresh') FROM rotate_auth_refresh_token(
    sha256('edge-original'::bytea),sha256('edge-next'::bytea));
RESET SESSION AUTHORIZATION;
SELECT auth_edges.assert((SELECT COUNT(*)=1 FROM auth_refresh_token WHERE session_id=(SELECT id FROM auth_edges.session)),'no successor on rejection');
ROLLBACK;
\echo 'PASS: invalid identities/hashes, expired tokens and inactive accounts'
