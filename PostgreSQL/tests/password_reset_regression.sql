-- Somente banco descartável. Inclui DML administrativo para preparar casos de borda.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA reset_test;
CREATE FUNCTION reset_test.assert(ok BOOLEAN,message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION reset_test.error(command TEXT,code TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN IF SQLSTATE=code THEN RETURN; END IF; RAISE; END;
 RAISE EXCEPTION 'Esperava SQLSTATE %',code;
END $$;
CREATE FUNCTION reset_test.uid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
 SELECT ('14000000-0000-0000-0000-'||lpad(n::TEXT,12,'0'))::UUID
$$;
GRANT USAGE ON SCHEMA reset_test TO olius_api;
INSERT INTO users(id,name,email,password_hash,user_type,status) VALUES
 (reset_test.uid(1),'Reset cidadão','Pessoa@example.test','old-hash','CITIZENS','ACTIVE'),
 (reset_test.uid(2),'Reset estabelecimento','pessoa@example.test','old-hash','ESTABLISHMENT','ACTIVE'),
 (reset_test.uid(3),'Reset administrador','admin-reset@example.test','old-hash','ADMIN','ACTIVE'),
 (reset_test.uid(4),'Inativo','inactive-reset@example.test','old-hash','CITIZENS','INACTIVE'),
 (reset_test.uid(5),'Limites','limits-reset@example.test','old-hash','CITIZENS','ACTIVE'),
 (reset_test.uid(6),'Links preservados','links-reset@example.test','old-hash','CITIZENS','ACTIVE'),
 (reset_test.uid(7),'Falha auditoria','fault-reset@example.test','old-hash','CITIZENS','ACTIVE'),
 (reset_test.uid(8),'E-mail legado inválido','wrong-reset@example.test@invalid','old-hash','CITIZENS','ACTIVE');
-- Emissões mais antigas são fixtures; o relógio da rotina não é substituído.
INSERT INTO password_reset_token(user_id,token_hash,issued_at,expires_at)
SELECT reset_test.uid(5),sha256(('limit-'||n)::BYTEA),clock_timestamp()-n*INTERVAL '2 minutes',
 clock_timestamp()+INTERVAL '30 minutes' FROM generate_series(1,3) n;
INSERT INTO password_reset_token(user_id,token_hash,issued_at,expires_at) VALUES
 (reset_test.uid(6),sha256('preserved-link'::BYTEA),clock_timestamp()-INTERVAL '2 minutes',clock_timestamp()+INTERVAL '28 minutes');
SET LOCAL SESSION AUTHORIZATION olius_api;
-- split_part não pode transformar um endereço legado malformado em outra conta.
SELECT reset_test.assert(result_code='USER_UNAVAILABLE','endereço malformado não é destinatário')
 FROM issue_password_reset('wrong-reset@example.test',sha256('wrong-reset-alone'::BYTEA));
RESET SESSION AUTHORIZATION;
SELECT reset_test.assert(NOT EXISTS(SELECT 1 FROM password_reset_token WHERE user_id=reset_test.uid(8)),'sem emissão para conta malformada');
INSERT INTO users(id,name,email,password_hash,user_type) VALUES(reset_test.uid(9),'Conta legítima','wrong-reset@example.test','old-hash','CITIZENS');
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT reset_test.assert(result_code='OK' AND user_id=reset_test.uid(9),'legítima não é bloqueada por endereço malformado')
 FROM issue_password_reset('wrong-reset@example.test',sha256('wrong-reset-legitimate'::BYTEA));
SELECT reset_test.assert(result_code='USER_UNAVAILABLE','conta inexistente')
 FROM issue_password_reset('missing@example.test',sha256('missing'::BYTEA));
SELECT reset_test.assert(result_code='USER_UNAVAILABLE','conta inativa')
 FROM issue_password_reset('inactive-reset@example.test',sha256('inactive'::BYTEA));
SELECT reset_test.assert(result_code='INVALID_INPUT','hash curto') FROM issue_password_reset('Pessoa@example.test','short'::BYTEA);
SELECT reset_test.assert(result_code='INVALID_INPUT','prazo inválido') FROM issue_password_reset('Pessoa@example.test',sha256('x'::BYTEA),INTERVAL '0 seconds');
SELECT reset_test.assert(result_code='INVALID_INPUT','e-mail malformado') FROM issue_password_reset('a@@b',sha256('x'::BYTEA));
SELECT reset_test.assert(result_code='INVALID_INPUT','prazo negativo') FROM issue_password_reset('Pessoa@example.test',sha256('x'::BYTEA),INTERVAL '-1 day');
SELECT reset_test.assert(result_code='INVALID_INPUT','prazo fora da representação') FROM issue_password_reset('Pessoa@example.test',sha256('x'::BYTEA),INTERVAL '178000000 years');
SELECT reset_test.assert(result_code='RATE_LIMITED','três emissões na janela móvel')
 FROM issue_password_reset('limits-reset@example.test',sha256('limit4'::BYTEA));
SELECT reset_test.assert(result_code='OK' AND user_id=reset_test.uid(1),'local exato e domínio normalizado')
 FROM issue_password_reset('Pessoa@EXAMPLE.TEST',sha256('first-reset'::BYTEA));
SELECT reset_test.assert(result_code='RATE_LIMITED','intervalo mínimo')
 FROM issue_password_reset('Pessoa@example.test',sha256('second-reset'::BYTEA));
SELECT reset_test.assert(result_code='HASH_CONFLICT','hash duplicado não cria emissão')
 FROM issue_password_reset('pessoa@example.test',sha256('first-reset'::BYTEA));
SELECT reset_test.assert(result_code='OK' AND user_id=reset_test.uid(2),'outra caixa local seleciona outra conta')
 FROM issue_password_reset('pessoa@example.test',sha256('est-reset'::BYTEA));
SELECT reset_test.assert(result_code='OK','nova emissão preserva links anteriores') FROM issue_password_reset('links-reset@example.test',sha256('new-preserved-link'::BYTEA));
SELECT reset_test.assert(result_code='OK','ADMIN elegível') FROM issue_password_reset('admin-reset@example.test',sha256('admin-reset'::BYTEA));
SELECT reset_test.assert(result_code='OK','sessão anterior') FROM open_auth_session(reset_test.uid(1),sha256('refresh-reset'::BYTEA),'old-hash');
SELECT reset_test.assert(result_code='CREDENTIAL_CHANGED','credencial divergente') FROM open_auth_session(reset_test.uid(1),sha256('refresh-bad'::BYTEA),'wrong-hash');
SELECT reset_test.error('SELECT token_hash FROM password_reset_token','42501');
SELECT reset_test.error('INSERT INTO password_reset_token DEFAULT VALUES','42501');
SELECT reset_test.error('UPDATE password_reset_token SET consumed_at=clock_timestamp()','42501');
SELECT reset_test.error('SELECT * FROM password_reset_token_log','42501');
RESET SESSION AUTHORIZATION;
SELECT reset_test.assert((SELECT count(*)=2 AND bool_and(consumed_at IS NULL AND invalidated_at IS NULL) FROM password_reset_token WHERE user_id=reset_test.uid(6)),'dois links pendentes preservados');
SELECT reset_test.assert((SELECT count(*)=1 FROM password_reset_token WHERE user_id=reset_test.uid(1)),'limite e duplicata sem emissão extra');
SELECT reset_test.assert((SELECT password_hash='old-hash' FROM users WHERE id=reset_test.uid(1)),'emissão não altera senha');
SELECT reset_test.assert((SELECT bool_and(revoked_at IS NULL) FROM auth_session WHERE user_id=reset_test.uid(1)),'emissão não revoga sessão');
INSERT INTO password_reset_token(user_id,token_hash,issued_at,expires_at) VALUES
 (reset_test.uid(1),sha256('older-reset'::BYTEA),clock_timestamp()-INTERVAL '2 minutes',clock_timestamp()+INTERVAL '20 minutes'),
 (reset_test.uid(1),sha256('expired-reset'::BYTEA),clock_timestamp()-INTERVAL '40 minutes',clock_timestamp()-INTERVAL '10 minutes'),
 (reset_test.uid(4),sha256('inactive-token'::BYTEA),clock_timestamp(),clock_timestamp()+INTERVAL '30 minutes');
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT reset_test.assert(complete_password_reset(NULL,'new-hash')='INVALID_INPUT','entrada nula');
SELECT reset_test.assert(complete_password_reset(sha256('first-reset'::BYTEA),'')='INVALID_INPUT','senha vazia');
SELECT reset_test.assert(complete_password_reset(sha256('first-reset'::BYTEA),repeat('x',256))='INVALID_INPUT','hash maior que coluna');
SELECT reset_test.assert(complete_password_reset(sha256('missing'::BYTEA),'new-hash')='INVALID_TOKEN','token inexistente');
SELECT reset_test.assert(complete_password_reset(sha256('expired-reset'::BYTEA),'new-hash')='INVALID_TOKEN','token expirado');
SELECT reset_test.assert(complete_password_reset(sha256('inactive-token'::BYTEA),'new-hash')='INVALID_TOKEN','inativação bloqueia conclusão');
SELECT set_config('app.audit_actor','EXTERNAL',true),set_config('app.current_user_id','invalid-uuid',true),
 set_config('app.operational_driver_id','invalid-uuid',true),set_config('app.audit_reason','caller',true);
SELECT reset_test.assert(complete_password_reset(sha256('first-reset'::BYTEA),'new-hash')='OK','recuperação completa');
SELECT reset_test.assert(current_setting('app.audit_actor')='EXTERNAL' AND current_setting('app.audit_reason')='caller'
 AND current_setting('app.current_user_id')='invalid-uuid' AND current_setting('app.operational_driver_id')='invalid-uuid','contexto restaurado');
SELECT reset_test.assert(complete_password_reset(sha256('first-reset'::BYTEA),'again-hash')='INVALID_TOKEN','uso único');
SELECT reset_test.assert(complete_password_reset(sha256('older-reset'::BYTEA),'again-hash')='INVALID_TOKEN','outro link invalidado');
SELECT reset_test.assert(result_code='CREDENTIAL_CHANGED','senha antiga não abre sessão') FROM open_auth_session(reset_test.uid(1),sha256('old-login'::BYTEA),'old-hash');
SELECT reset_test.assert(result_code='SESSION_REVOKED','refresh anterior rejeitado') FROM rotate_auth_refresh_token(sha256('refresh-reset'::BYTEA),sha256('successor'::BYTEA));
RESET SESSION AUTHORIZATION;
SELECT set_config('app.audit_actor','SYSTEM',true),set_config('app.current_user_id','',true),set_config('app.operational_driver_id','',true);
SELECT reset_test.assert((SELECT count(*)=1 AND bool_and(revocation_reason='PASSWORD_RESET') FROM auth_session WHERE user_id=reset_test.uid(1)),'sem login automático, todas as sessões revogadas');
SELECT reset_test.assert((SELECT password_hash='new-hash' AND status='ACTIVE' AND user_type='CITIZENS' FROM users WHERE id=reset_test.uid(1)),'somente credencial alterada');
SELECT reset_test.assert((SELECT consumed_at IS NOT NULL FROM password_reset_token WHERE token_hash=sha256('first-reset'::BYTEA)),'consumo persistido');
SELECT reset_test.assert((SELECT bool_and(invalidated_at IS NOT NULL) FROM password_reset_token WHERE user_id=reset_test.uid(1) AND consumed_at IS NULL),'invalida inclusive pendentes expirados');
SELECT reset_test.assert(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('password_reset_token_log','users_log','auth_session_log') AND column_name IN ('token_hash','password_hash','token')),'sem segredos nos logs');
SELECT reset_test.assert((SELECT bool_and(actor_kind='SYSTEM' AND performed_by IS NULL) FROM password_reset_token_log),'sem autoria ADMIN fictícia');
SELECT reset_test.assert(EXISTS(SELECT 1 FROM password_reset_token_log l JOIN password_reset_token t ON t.id=l.id
 WHERE t.token_hash=sha256('first-reset'::BYTEA) AND l.operation='INSERT' AND l.snapshot_kind='AFTER'
 AND l.consumed_at IS NULL AND l.invalidated_at IS NULL),'emissão auditada');
SELECT reset_test.assert(EXISTS(SELECT 1 FROM password_reset_token_log a JOIN password_reset_token_log b
 ON b.id=a.id AND b.audit_event_id=a.audit_event_id JOIN password_reset_token t ON t.id=a.id
 WHERE t.token_hash=sha256('first-reset'::BYTEA) AND a.operation='UPDATE' AND b.operation='UPDATE'
 AND a.snapshot_kind='AFTER' AND b.snapshot_kind='BEFORE'
 AND a.consumed_at IS NOT NULL AND b.consumed_at IS NULL),'par de consumo auditado');
SELECT reset_test.assert(EXISTS(SELECT 1 FROM password_reset_token_log a JOIN password_reset_token_log b
 ON b.id=a.id AND b.audit_event_id=a.audit_event_id JOIN password_reset_token t ON t.id=a.id
 WHERE t.token_hash=sha256('older-reset'::BYTEA) AND a.operation='UPDATE' AND b.operation='UPDATE'
 AND a.snapshot_kind='AFTER' AND b.snapshot_kind='BEFORE'
 AND a.invalidated_at IS NOT NULL AND b.invalidated_at IS NULL),'par de invalidação auditado');

SELECT reset_test.assert(to_regprocedure('public.open_auth_session(uuid,bytea)') IS NULL,'nenhum caminho antigo de login');
SELECT reset_test.error('INSERT INTO password_reset_token(user_id,token_hash,issued_at,expires_at) VALUES(reset_test.uid(1),sha256(''infinite''::BYTEA),clock_timestamp(),''infinity'')','23514');
SELECT reset_test.error('UPDATE password_reset_token SET token_hash=sha256(''tamper''::BYTEA)','55000');
SELECT reset_test.error('DELETE FROM password_reset_token','55000');
SELECT reset_test.error('TRUNCATE password_reset_token','55000');
SELECT reset_test.error('UPDATE password_reset_token SET consumed_at=NULL WHERE consumed_at IS NOT NULL','55000');
-- Uma violação inesperada da auditoria não pode ser disfarçada de hash duplicado.
CREATE FUNCTION reset_test.fail_reset_log() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Falha simulada no log' USING ERRCODE='23505',CONSTRAINT='reset_test_fault'; END $$;
CREATE TRIGGER trg_reset_log_fault BEFORE INSERT ON password_reset_token_log FOR EACH ROW EXECUTE FUNCTION reset_test.fail_reset_log();
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT reset_test.error('SELECT issue_password_reset(''fault-reset@example.test'',sha256(''fault-reset''::BYTEA))','23505');
RESET SESSION AUTHORIZATION;
SELECT reset_test.assert(NOT EXISTS(SELECT 1 FROM password_reset_token WHERE user_id=reset_test.uid(7)),'falha da emissão não persiste token');
DROP TRIGGER trg_reset_log_fault ON password_reset_token_log;
-- Injeção de falha depois da senha e do consumo: toda a função deve reverter.
CREATE FUNCTION reset_test.fail_session() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Falha simulada' USING ERRCODE='P7001'; END $$;
SELECT * FROM open_auth_session(reset_test.uid(2),sha256('est-refresh'::BYTEA),'old-hash');
CREATE TRIGGER trg_reset_test_fault BEFORE UPDATE ON auth_session FOR EACH ROW EXECUTE FUNCTION reset_test.fail_session();
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT reset_test.error('SELECT complete_password_reset(sha256(''est-reset''::BYTEA),''rollback-hash'')','P7001');
RESET SESSION AUTHORIZATION;
SELECT reset_test.assert((SELECT password_hash='old-hash' FROM users WHERE id=reset_test.uid(2)),'falha reverte senha');
SELECT reset_test.assert((SELECT consumed_at IS NULL AND invalidated_at IS NULL FROM password_reset_token WHERE token_hash=sha256('est-reset'::BYTEA)),'falha reverte token');
SELECT reset_test.assert((SELECT bool_and(revoked_at IS NULL) FROM auth_session WHERE user_id=reset_test.uid(2)),'falha reverte sessões');
DROP TRIGGER trg_reset_test_fault ON auth_session;
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT reset_test.assert(result_code='OK','nova senha abre sessão') FROM open_auth_session(reset_test.uid(1),sha256('new-login'::BYTEA),'new-hash');
SELECT reset_test.assert(complete_password_reset(sha256('admin-reset'::BYTEA),'admin-new')='OK','ADMIN recupera sem convite');
RESET SESSION AUTHORIZATION;
SELECT reset_test.assert((SELECT status='ACTIVE' AND user_type='ADMIN' FROM users WHERE id=reset_test.uid(3)),'proteção ADMIN preservada');
GRANT USAGE ON SCHEMA reset_test TO olius_redis_api,olius_bi_reader;
SET LOCAL SESSION AUTHORIZATION olius_redis_api;
SELECT reset_test.error('SELECT complete_password_reset(NULL,NULL)','42501');
RESET SESSION AUTHORIZATION;
SET LOCAL SESSION AUTHORIZATION olius_bi_reader;
SELECT reset_test.error('SELECT issue_password_reset(NULL,NULL)','42501');
RESET SESSION AUTHORIZATION;
ROLLBACK;
\echo 'PASS: password reset funcional, limites, permissões, auditoria e rollback'
