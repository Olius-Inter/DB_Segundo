-- Somente PostgreSQL 16.15 descartável, depois dos scripts principais e catálogo 01..08.
-- Executar como administrador do ambiente de teste. Todas as alterações são revertidas.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA catalog_test;
CREATE FUNCTION catalog_test.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
CREATE FUNCTION catalog_test.denied(command text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE command;
    EXCEPTION WHEN insufficient_privilege THEN RETURN;
    END;
    RAISE EXCEPTION 'FAIL: acesso indevido permitido: %',command;
END $$;
GRANT USAGE ON SCHEMA catalog_test TO olius_owner,olius_reader,olius_catalog_editor,olius_auditor;

SELECT catalog_test.assert((SELECT count(*)=58 FROM public.data_catalog_table),'58 tabelas catalogadas');
SELECT catalog_test.assert((SELECT count(*)=828 FROM public.data_catalog_column),'828 colunas documentadas');
SELECT catalog_test.assert(NOT EXISTS(SELECT 1 FROM public.data_catalog_column WHERE documentation_status='PENDING'),'sem colunas pendentes');
SELECT catalog_test.assert(NOT EXISTS(SELECT 1 FROM public.data_catalog_table WHERE access_status='PENDING' OR domain_name='Pendente de classificação'),'sem tabelas pendentes');
SELECT catalog_test.assert((SELECT count(*)=55 FROM (SELECT DISTINCT table_name FROM public.vw_data_catalog) t),'view exclui 3 tabelas documentais');
SELECT catalog_test.assert((SELECT count(*)=808 FROM (SELECT DISTINCT table_name,column_name FROM public.vw_data_catalog) t),'808 colunas distintas na view');
SELECT catalog_test.assert((SELECT count(*)=5 FROM public.data_catalog_role),'cinco perfis documentais');
SELECT catalog_test.assert((SELECT count(*)=8 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner='olius_auth_owner'::regrole),'oito funções mantidas no auth_owner');

SET LOCAL SESSION AUTHORIZATION pedro;
ALTER TABLE public.collection ADD COLUMN catalog_test_pedro text;
ALTER FUNCTION public.get_cycle_availability(uuid) COST 101;
INSERT INTO public.establishment_type(id,name) VALUES ('90000000-0000-0000-0000-000000000001','Teste de acesso');
UPDATE public.establishment_type SET name='Teste Pedro' WHERE id='90000000-0000-0000-0000-000000000001';
SELECT catalog_test.denied('SET ROLE olius_auth_owner');
SELECT catalog_test.denied('ALTER FUNCTION public.open_auth_session(uuid,bytea) COST 200');
SELECT catalog_test.denied('CREATE ROLE nao_autorizado');
SET LOCAL ROLE olius_owner;
CREATE TABLE public.catalog_test_owned(id integer);
CREATE FUNCTION public.catalog_test_future() RETURNS integer LANGUAGE sql AS 'SELECT 1';
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET LOCAL SESSION AUTHORIZATION caio;
ALTER TABLE public.collection DROP COLUMN catalog_test_pedro;
ALTER TABLE public.catalog_test_owned ADD COLUMN maintained_by_caio text;
ALTER FUNCTION public.get_cycle_availability(uuid) COST 102;
UPDATE public.establishment_type SET name='Teste Caio' WHERE id='90000000-0000-0000-0000-000000000001';
DELETE FROM public.establishment_type WHERE id='90000000-0000-0000-0000-000000000001';
DROP TABLE public.catalog_test_owned;
SELECT catalog_test.denied('SET ROLE olius_auth_owner');
RESET SESSION AUTHORIZATION;

-- Repete os testes sob a identidade efetiva de cada integrante, não como superusuário.
SET LOCAL SESSION AUTHORIZATION matheus;
SELECT count(*) FROM public.collection;
SELECT id,name,user_type,status FROM public.users LIMIT 1;
SELECT count(*) FROM public.vw_data_catalog;
SELECT catalog_test.denied('SELECT password_hash FROM public.users');
SELECT catalog_test.denied('SELECT token_hash FROM public.auth_refresh_token');
SELECT catalog_test.denied('SELECT * FROM public.collection_log');
SELECT catalog_test.denied('INSERT INTO public.establishment_type(name) VALUES (''Bloqueado'')');
SELECT catalog_test.denied('UPDATE public.collection SET collected_volume_liters=0 WHERE false');
SELECT catalog_test.denied('DELETE FROM public.collection WHERE false');
SELECT catalog_test.denied('TRUNCATE public.collection');
SELECT catalog_test.denied('ALTER TABLE public.collection ADD COLUMN forbidden integer');
SELECT catalog_test.denied('SELECT public.open_auth_session(NULL,NULL)');
SELECT catalog_test.denied('SELECT public.catalog_test_future()');
SELECT catalog_test.denied('SET ROLE olius_owner');
SELECT catalog_test.denied('GRANT olius_reader TO caio');
RESET SESSION AUTHORIZATION;

SET LOCAL SESSION AUTHORIZATION guilherme;
SELECT count(*) FROM public.collection;
SELECT count(*) FROM public.vw_data_catalog;
SELECT catalog_test.denied('SELECT password_hash FROM public.users');
SELECT catalog_test.denied('UPDATE public.collection SET collected_volume_liters=0 WHERE false');
SELECT catalog_test.denied('SET ROLE olius_owner');
RESET SESSION AUTHORIZATION;

SET LOCAL SESSION AUTHORIZATION david;
SELECT count(*) FROM public.delivery_pev;
SELECT count(*) FROM public.vw_data_catalog;
SELECT catalog_test.denied('SELECT token_hash FROM public.auth_refresh_token');
SELECT catalog_test.denied('DELETE FROM public.collection WHERE false');
SELECT catalog_test.denied('SET ROLE olius_auth_owner');
RESET SESSION AUTHORIZATION;

SET LOCAL SESSION AUTHORIZATION erick;
SELECT count(*) FROM public.subscription_plan;
SELECT count(*) FROM public.vw_data_catalog;
SELECT catalog_test.denied('SELECT password_hash FROM public.users');
SELECT catalog_test.denied('INSERT INTO public.establishment_type(name) VALUES (''Bloqueado'')');
SELECT catalog_test.denied('SET ROLE olius_owner');
RESET SESSION AUTHORIZATION;

SET LOCAL SESSION AUTHORIZATION olius_catalog_editor;
UPDATE public.data_catalog_column SET description=description WHERE false;
SELECT count(*) FROM public.vw_data_catalog;
SELECT catalog_test.denied('UPDATE public.collection SET collected_volume_liters=0 WHERE false');
RESET SESSION AUTHORIZATION;
SET LOCAL SESSION AUTHORIZATION olius_auditor;
SELECT count(*) FROM public.collection_log;
SELECT catalog_test.denied('UPDATE public.collection_log SET audit_reason=NULL WHERE false');
SELECT catalog_test.denied('SELECT * FROM public.auth_session_log');
RESET SESSION AUTHORIZATION;

SELECT catalog_test.assert(NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('pedro','caio','matheus','guilherme','david','erick') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)),'sem privilégios globais');
SELECT catalog_test.assert(NOT EXISTS(SELECT 1 FROM pg_authid WHERE rolname IN ('pedro','caio','matheus','guilherme','david','erick') AND rolpassword IS NOT NULL),'nenhuma senha criada');
ROLLBACK;
\echo PASS: catalog coverage, ownership, six accounts, readers and auth boundary
