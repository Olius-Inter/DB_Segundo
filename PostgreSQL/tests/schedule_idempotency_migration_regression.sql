\set ON_ERROR_STOP on
-- Executado antes da medição, em banco descartável confirmado pelo runner.
DO $test$
BEGIN
    IF EXISTS (SELECT 1 FROM public.collection_schedule_command) THEN
        RAISE EXCEPTION 'Teste de migração exige tabela de comandos vazia.';
    END IF;
END $test$;
CREATE TEMP TABLE schedule_once_before AS
SELECT pg_get_functiondef(oid) AS definition FROM pg_proc
WHERE oid='public.schedule_collection_request_once(uuid,timestamptz,timestamptz,uuid,text,uuid)'::regprocedure;
DROP PROCEDURE public.schedule_collection_request_once(UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,UUID);
DROP TABLE public.collection_schedule_command;
SET SESSION AUTHORIZATION olius_owner;
\ir ../migrations/20261104_schedule_idempotency.sql
RESET SESSION AUTHORIZATION;
DO $test$
BEGIN
    IF (SELECT pg_get_functiondef('public.schedule_collection_request_once(uuid,timestamptz,timestamptz,uuid,text,uuid)'::regprocedure))
        IS DISTINCT FROM (SELECT definition FROM schedule_once_before) THEN
        RAISE EXCEPTION 'Rotina da migração diverge da instalação.';
    END IF;
    IF NOT has_function_privilege('olius_api',
        'public.schedule_collection_request_once(uuid,timestamptz,timestamptz,uuid,text,uuid)','EXECUTE')
       OR has_table_privilege('olius_api','public.collection_schedule_command','SELECT')
       OR has_table_privilege('olius_api','public.collection_schedule_command','INSERT')
       OR has_table_privilege('olius_api','public.collection_schedule_command','UPDATE')
       OR has_table_privilege('olius_api','public.collection_schedule_command','DELETE') THEN
        RAISE EXCEPTION 'Permissões da migração incompatíveis.';
    END IF;
END $test$;
DROP TABLE schedule_once_before;
\echo 'PASS: schedule idempotency migration without superuser, definition and permissions'
