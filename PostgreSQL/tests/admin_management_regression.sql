-- Somente banco descartável. Todos os registros são revertidos.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA admin_test;
CREATE TABLE admin_test.ids(kind TEXT PRIMARY KEY,id UUID);
CREATE FUNCTION admin_test.id(TEXT) RETURNS UUID LANGUAGE SQL STABLE AS
$$ SELECT id FROM admin_test.ids WHERE kind=$1 $$;
CREATE FUNCTION admin_test.assert(BOOLEAN,TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF $1 IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'ADMIN TEST: %',$2; END IF; END $$;
CREATE FUNCTION admin_test.error(TEXT,TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE $1;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE=$2 THEN RETURN; END IF;
        RAISE EXCEPTION 'ADMIN TEST: esperado %, recebido %: %',$2,SQLSTATE,SQLERRM;
    END;
    RAISE EXCEPTION 'ADMIN TEST: operação deveria falhar: %',$1;
END $$;
GRANT USAGE ON SCHEMA admin_test TO olius_api;
GRANT SELECT,INSERT ON admin_test.ids TO olius_api;

SELECT admin_test.assert(NOT EXISTS(SELECT 1 FROM public.users WHERE user_type='ADMIN'),'bootstrap começa sem ADMIN');
SELECT admin_test.error('SELECT public.issue_bootstrap_admin_invitation(NULL,''project@example.invalid'',sha256(''a''::bytea))','22023');
INSERT INTO admin_test.ids VALUES('bootstrap',public.issue_bootstrap_admin_invitation(
    'Projeto demonstração',' Project@Example.Invalid ',sha256('bootstrap-test'::bytea)));
SELECT public.issue_bootstrap_admin_invitation('Outro bootstrap','bootstrap-second@example.invalid',sha256('bootstrap-second-test'::bytea));
SELECT admin_test.assert(NOT EXISTS(SELECT 1 FROM public.users),'convite não cria conta');

SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT admin_test.error('SELECT public.issue_bootstrap_admin_invitation(''x'',''x@example.invalid'',sha256(''x''::bytea))','42501');
SELECT admin_test.error('SELECT public.create_admin_invitation_internal(NULL,''x'',''x@example.invalid'',sha256(''x''::bytea))','42501');
SELECT admin_test.error('SELECT token_hash FROM public.admin_invitation','42501');
SELECT admin_test.error('UPDATE public.admin_invitation SET accepted_at=now()','42501');
SELECT admin_test.error('SELECT * FROM public.admin_guard_state','42501');
SELECT admin_test.error('SELECT public.accept_admin_invitation(NULL,''hash'')','22023');
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''missing''::bytea),''hash'')','55000');
INSERT INTO admin_test.ids VALUES('first',public.accept_admin_invitation(sha256('bootstrap-test'::bytea),'hash-apenas-teste'));
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''bootstrap-test''::bytea),''hash'')','55000');
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''bootstrap-second-test''::bytea),''hash'')','55000');
SELECT admin_test.error('INSERT INTO public.users(name,email,password_hash,user_type) VALUES(''Bypass'',''bypass@example.invalid'',''hash'',''ADMIN'')','42501');
SELECT admin_test.error(format('UPDATE public.users SET status=''INACTIVE'' WHERE id=%L',admin_test.id('first')),'42501');
SELECT admin_test.error(format('SELECT public.set_admin_status(%L,%L,''INACTIVE'')',admin_test.id('first'),admin_test.id('first')),'55000');
SELECT admin_test.error('SELECT public.issue_admin_invitation(NULL,''x'',''x@example.invalid'',sha256(''x''::bytea))','42501');
SELECT admin_test.error('SELECT public.issue_admin_invitation(gen_random_uuid(),''x'',''x@example.invalid'',sha256(''x''::bytea))','42501');
SELECT admin_test.error(format('SELECT public.issue_admin_invitation(%L,''x'',''PROJECT@EXAMPLE.INVALID'',sha256(''exists''::bytea))',admin_test.id('first')),'23505');

INSERT INTO admin_test.ids VALUES('second_invite',public.issue_admin_invitation(
    admin_test.id('first'),'Segundo','second@example.invalid',sha256('second-test'::bytea)));
INSERT INTO admin_test.ids VALUES('second',public.accept_admin_invitation(sha256('second-test'::bytea),'hash-apenas-teste'));
SELECT admin_test.error(format('SELECT public.revoke_admin_invitation(%L,%L)',admin_test.id('first'),admin_test.id('second_invite')),'55000');
SELECT admin_test.error(format('SELECT public.revoke_admin_invitation(%L,gen_random_uuid())',admin_test.id('first')),'P0002');
SELECT admin_test.error(format('SELECT public.set_admin_status(%L,gen_random_uuid(),''INACTIVE'')',admin_test.id('first')),'P0002');
SELECT admin_test.error(format('SELECT public.set_admin_status(%L,%L,NULL)',admin_test.id('first'),admin_test.id('second')),'22023');
SELECT public.open_auth_session(admin_test.id('second'),sha256('session-test'::bytea));
SELECT public.set_admin_status(admin_test.id('first'),admin_test.id('second'),'INACTIVE');
SELECT admin_test.assert((SELECT result_code='USER_UNAVAILABLE' FROM public.open_auth_session(
    admin_test.id('second'),sha256('inactive-session-test'::bytea))),'ADMIN inativo sem sessão nova');
SELECT public.set_admin_status(admin_test.id('first'),admin_test.id('second'),'ACTIVE');

INSERT INTO admin_test.ids VALUES('old',public.issue_admin_invitation(admin_test.id('first'),'Reenvio','resend@example.invalid',sha256('old-test'::bytea)));
INSERT INTO admin_test.ids VALUES('new',public.issue_admin_invitation(admin_test.id('first'),'Reenvio','resend@example.invalid',sha256('new-test'::bytea)));
SELECT admin_test.assert((SELECT revoked_at IS NOT NULL FROM public.admin_invitation WHERE id=admin_test.id('old')),'reenvio revoga o anterior');
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''old-test''::bytea),''hash'')','55000');
SELECT admin_test.error(format('SELECT public.issue_admin_invitation(%L,''x'',''reuse@example.invalid'',sha256(''old-test''::bytea))',admin_test.id('first')),'23505');
SELECT admin_test.assert(public.revoke_admin_invitation(admin_test.id('second'),admin_test.id('new')),'outro ADMIN pode revogar');
SELECT admin_test.assert(NOT public.revoke_admin_invitation(admin_test.id('second'),admin_test.id('new')),'revogação repetida sem alteração');

INSERT INTO admin_test.ids VALUES('author_inactive',public.issue_admin_invitation(
    admin_test.id('first'),'Autor inativo','author@example.invalid',sha256('author-test'::bytea)));
SELECT public.set_admin_status(admin_test.id('first'),admin_test.id('first'),'INACTIVE');
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''author-test''::bytea),''hash'')','42501');
SELECT admin_test.error(format('SELECT public.issue_admin_invitation(%L,''x'',''x@example.invalid'',sha256(''inactive''::bytea))',admin_test.id('first')),'42501');
SELECT admin_test.error(format('SELECT public.revoke_admin_invitation(%L,%L)',admin_test.id('first'),admin_test.id('author_inactive')),'42501');
SELECT admin_test.error(format('SELECT public.set_admin_status(%L,%L,''ACTIVE'')',admin_test.id('first'),admin_test.id('first')),'42501');
SELECT public.set_admin_status(admin_test.id('second'),admin_test.id('first'),'ACTIVE');

INSERT INTO admin_test.ids VALUES('expired',public.issue_admin_invitation(
    admin_test.id('first'),'Expirado','expired@example.invalid',sha256('expired-test'::bytea)));
INSERT INTO admin_test.ids VALUES('occupied',public.issue_admin_invitation(
    admin_test.id('first'),'Ocupado','occupied@example.invalid',sha256('occupied-test'::bytea)));
INSERT INTO public.users(name,email,password_hash,user_type) VALUES('Cidadão','occupied@example.invalid','hash','CITIZENS');
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''occupied-test''::bytea),''hash'')','23505');
SELECT admin_test.error(format('SELECT public.issue_admin_invitation(%L,''x'',''occupied@example.invalid'',sha256(''occupied-again''::bytea))',admin_test.id('first')),'23505');
RESET SESSION AUTHORIZATION;

UPDATE public.admin_invitation SET issued_at=CURRENT_TIMESTAMP-INTERVAL '25 hours',expires_at=CURRENT_TIMESTAMP-INTERVAL '1 hour'
WHERE id=admin_test.id('expired');
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT admin_test.error('SELECT public.accept_admin_invitation(sha256(''expired-test''::bytea),''hash'')','55000');
RESET SESSION AUTHORIZATION;
SELECT admin_test.error('SELECT public.issue_bootstrap_admin_invitation(''x'',''x@example.invalid'',sha256(''again''::bytea))','55000');
SELECT admin_test.assert(EXISTS(SELECT 1 FROM public.auth_session WHERE user_id=admin_test.id('second') AND revoked_at IS NOT NULL),'inativação revoga sessões');
SELECT admin_test.assert(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_invitation_log' AND column_name='token_hash'),'hash fora dos logs');
SELECT admin_test.assert(EXISTS(SELECT 1 FROM public.admin_invitation_log WHERE accepted_user_id=admin_test.id('first')),'aceite auditado');
-- Até manutenção direta deve preservar o último ADMIN ativo.
SELECT public.set_admin_status(admin_test.id('second'),admin_test.id('first'),'INACTIVE');
SELECT admin_test.error(format('UPDATE public.users SET user_type=''CITIZENS'' WHERE id=%L',admin_test.id('second')),'55000');
SELECT admin_test.error(format('DELETE FROM public.users WHERE id=%L',admin_test.id('second')),'55000');
SELECT admin_test.error('TRUNCATE public.users CASCADE','55000');
DELETE FROM public.users WHERE email='occupied@example.invalid';
DELETE FROM public.admin_guard_state;
SELECT admin_test.error('SELECT public.lock_admin_registry()','55000');
INSERT INTO public.admin_guard_state(singleton) VALUES(TRUE);
ROLLBACK;
