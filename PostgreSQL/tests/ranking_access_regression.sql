-- Executar com implantação autorizada após catálogo, roles e users; fixtures revertidas.
\set ON_ERROR_STOP on
-- Confirma que reaplicar a matriz remove escrita concedida manualmente ao grupo.
GRANT UPDATE(name) ON public.users TO olius_ranking_reader;
\ir ../access_control/01_roles.sql
\ir ../access_control/02_users.sql
BEGIN;
\ir fixtures_procedures.sql
CREATE SCHEMA ranking_test;
CREATE FUNCTION ranking_test.assert(ok BOOLEAN, message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION ranking_test.denied(command TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE command; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
    RAISE EXCEPTION 'FAIL: acesso indevido: %',command;
END $$;
GRANT USAGE ON SCHEMA ranking_test TO olius_ranking_reader;
SELECT ranking_test.assert(NOT has_column_privilege('olius_ranking_reader','public.users','name','UPDATE'), 'reaplicação remove escrita manual');
SELECT ranking_test.assert((SELECT count(*)=1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='olius_redis_api'), 'conta possui somente um grupo');
SELECT ranking_test.assert(pg_has_role('olius_redis_api','olius_ranking_reader','USAGE'), 'conta herda grupo restrito');
DO $$ DECLARE request UUID; collection_id UUID; delivery UUID;
BEGIN
    request:=olius_test.request();
    CALL public.record_collection(request,olius_test.id('driver'),10,10,'ACCEPTABLE',false,
        ARRAY[]::text[],NULL,clock_timestamp(),collection_id);
    CALL public.record_pev_delivery(gen_random_uuid(),olius_test.id('citizen'),olius_test.id('pev'),
        olius_test.id('validator'),25,clock_timestamp(),delivery);
END $$;
SET LOCAL SESSION AUTHORIZATION olius_redis_api;
-- Uma consulta: os dois perfis e os metadados vêm do mesmo snapshot.
SELECT s.profile,s.ranking_year,s.participant_id::text,s.annual_points,u.name,a.city
FROM public.vw_annual_scores s JOIN public.users u ON u.id=s.participant_id
LEFT JOIN public.establishment e ON e.id=s.participant_id AND s.profile='B2B'
LEFT JOIN public.addresses a ON a.id=e.address_id
WHERE u.status='ACTIVE'
ORDER BY s.profile,s.annual_points DESC,s.participant_id;
SELECT ranking_test.assert((SELECT count(*)=2 FROM public.vw_annual_scores s
    JOIN public.users u ON u.id=s.participant_id WHERE u.status='ACTIVE'), 'dois perfis ativos');
SELECT ranking_test.assert((SELECT bool_and((s.profile='B2C' AND a.city IS NULL)
    OR (s.profile='B2B' AND a.city IS NOT NULL)) FROM public.vw_annual_scores s
    LEFT JOIN public.establishment e ON e.id=s.participant_id AND s.profile='B2B'
    LEFT JOIN public.addresses a ON a.id=e.address_id), 'cidade apenas no B2B');
SELECT ranking_test.denied('SELECT email FROM public.users');
SELECT ranking_test.denied('SELECT password_hash FROM public.users');
SELECT ranking_test.denied('SELECT * FROM public.users');
SELECT ranking_test.denied('SELECT street FROM public.addresses');
SELECT ranking_test.denied('SELECT points FROM public.establishment');
SELECT ranking_test.denied('SELECT * FROM public.collection');
SELECT ranking_test.denied('SELECT * FROM public.delivery_pev');
SELECT ranking_test.denied('SELECT * FROM public.point_calculation');
SELECT ranking_test.denied('SELECT * FROM public.point_transaction');
SELECT ranking_test.denied('SELECT * FROM public.auth_session');
SELECT ranking_test.denied('SELECT * FROM public.admin_invitation');
SELECT ranking_test.denied('SELECT * FROM public.vw_annual_ranking');
SELECT ranking_test.denied('SELECT * FROM dm.ranking_anual');
SELECT ranking_test.denied('UPDATE public.users SET name=name WHERE false');
SELECT ranking_test.denied('INSERT INTO public.collection DEFAULT VALUES');
SELECT ranking_test.denied('DELETE FROM public.delivery_pev WHERE false');
SELECT ranking_test.denied('SELECT * FROM public.open_auth_session(NULL,NULL)');
SELECT ranking_test.denied('SET ROLE olius_owner');
SELECT ranking_test.denied('SET ROLE olius_api');
SELECT ranking_test.denied('CREATE TABLE public.ranking_forbidden(id integer)');
RESET SESSION AUTHORIZATION;
UPDATE public.users SET status='INACTIVE' WHERE id=olius_test.id('citizen');
SET LOCAL SESSION AUTHORIZATION olius_redis_api;
SELECT ranking_test.assert((SELECT count(*)=1 FROM public.vw_annual_scores s
    JOIN public.users u ON u.id=s.participant_id WHERE u.status='ACTIVE'), 'consulta remove inativo');
RESET SESSION AUTHORIZATION;
ROLLBACK;
\echo 'PASS: conta Redis, consulta do ranking, leituras restritas, negações e reaplicação'
