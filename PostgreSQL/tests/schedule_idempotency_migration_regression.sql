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
CREATE TEMP TABLE schedule_catalog_before AS
SELECT schema_name,table_name,domain_name,description,business_rules,access_policy,access_status,source_reference
FROM public.data_catalog_table WHERE schema_name='public' AND table_name='collection_schedule_command';
CREATE TEMP TABLE schedule_columns_before AS
SELECT c.column_name,c.description,c.documentation_status,c.source_reference
FROM public.data_catalog_column c JOIN public.data_catalog_table t ON t.id=c.table_catalog_id
WHERE t.schema_name='public' AND t.table_name='collection_schedule_command';
-- Simula a base anterior sem deixar os metadados da instalação nova mascararem a falha.
DELETE FROM public.data_catalog_column WHERE table_catalog_id IN (
    SELECT id FROM public.data_catalog_table WHERE schema_name='public' AND table_name='collection_schedule_command');
DELETE FROM public.data_catalog_table WHERE schema_name='public' AND table_name='collection_schedule_command';
DROP PROCEDURE public.schedule_collection_request_once(UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,UUID);
DROP TABLE public.collection_schedule_command;
SET SESSION AUTHORIZATION olius_owner;
\ir ../migrations/20261104_schedule_idempotency.sql
RESET SESSION AUTHORIZATION;
DO $test$
BEGIN
    IF (SELECT count(*) FROM public.data_catalog_table t
        JOIN schedule_catalog_before b USING(schema_name,table_name,domain_name,description,
            business_rules,access_policy,access_status,source_reference)) <> 1
       OR (SELECT count(*) FROM public.data_catalog_column c
           JOIN public.data_catalog_table t ON t.id=c.table_catalog_id
           JOIN schedule_columns_before b ON b.column_name=c.column_name
               AND b.description=c.description AND b.documentation_status=c.documentation_status
               AND b.source_reference=c.source_reference
           WHERE t.schema_name='public' AND t.table_name='collection_schedule_command') <> 6
       OR (SELECT count(DISTINCT column_name) FROM public.vw_data_catalog
           WHERE table_name='collection_schedule_command') <> 6 THEN
        RAISE EXCEPTION 'Migração não preserva equivalência do catálogo e suas seis colunas.';
    END IF;
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
DROP TABLE schedule_once_before,schedule_catalog_before,schedule_columns_before;
\echo 'PASS: schedule idempotency migration without superuser, definition, permissions and catalog parity'
