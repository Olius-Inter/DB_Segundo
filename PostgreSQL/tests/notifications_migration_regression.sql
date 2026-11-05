\set ON_ERROR_STOP on
-- O runner exige uma base vazia e descartável antes da instalação.
-- Reconstitui o estado anterior sem os objetos nem os metadados desta entrega.
DO $test$
BEGIN
    IF EXISTS (SELECT 1 FROM public.notification) THEN
        RAISE EXCEPTION 'Teste de migração exige central vazia.';
    END IF;
END $test$;
CREATE TEMP TABLE notification_function_before AS
SELECT proname, pg_get_functiondef(oid) AS definition
FROM pg_proc WHERE pronamespace='public'::regnamespace
AND proname IN ('notify_pev_status_change','notify_collection_schedule_change');

-- Guardar os metadados da instalação limpa permite comparar os dois caminhos.
CREATE TEMP TABLE notification_catalog_before AS
SELECT schema_name,table_name,domain_name,description,business_rules,access_policy,access_status,source_reference
FROM public.data_catalog_table WHERE schema_name='public' AND table_name='notification';
CREATE TEMP TABLE notification_columns_before AS
SELECT c.column_name,c.description,c.documentation_status,c.source_reference
FROM public.data_catalog_column c JOIN public.data_catalog_table t ON t.id=c.table_catalog_id
WHERE t.schema_name='public' AND t.table_name='notification';
DELETE FROM public.data_catalog_column WHERE table_catalog_id IN (
    SELECT id FROM public.data_catalog_table WHERE schema_name='public' AND table_name='notification');
DELETE FROM public.data_catalog_table WHERE schema_name='public' AND table_name='notification';

DROP FUNCTION public.notify_pev_status_change() CASCADE;
DROP FUNCTION public.notify_collection_schedule_change() CASCADE;
DROP TABLE public.notification;

-- A migração inteira executa sob o proprietário NOLOGIN sem SUPERUSER.
SET SESSION AUTHORIZATION olius_owner;
\ir ../migrations/20261104_notifications.sql
RESET SESSION AUTHORIZATION;

DO $test$
BEGIN
    IF (SELECT count(*) FROM public.data_catalog_table
        WHERE schema_name='public' AND table_name='notification') <> 1
       OR (SELECT count(DISTINCT column_name) FROM public.vw_data_catalog WHERE table_name='notification') <> 10 THEN
        RAISE EXCEPTION 'Migração não documentou a tabela e suas dez colunas na view.';
    END IF;
    IF (SELECT count(*) FROM public.data_catalog_table t
        JOIN notification_catalog_before b USING(schema_name,table_name,domain_name,description,
            business_rules,access_policy,access_status,source_reference)) <> 1
       OR (SELECT count(*) FROM public.data_catalog_column c
           JOIN public.data_catalog_table t ON t.id=c.table_catalog_id
           JOIN notification_columns_before b ON b.column_name=c.column_name
               AND b.description=c.description AND b.documentation_status=c.documentation_status
               AND b.source_reference=c.source_reference
           WHERE t.schema_name='public' AND t.table_name='notification') <> 10 THEN
        RAISE EXCEPTION 'Catálogo da migração diverge da instalação limpa.';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint
        WHERE conrelid='public.notification'::regclass AND conname='ck_notification_type' AND contype='c') THEN
        RAISE EXCEPTION 'CHECK de notificações ausente após migração.';
    END IF;
    IF (SELECT count(*) FROM pg_proc p
        JOIN notification_function_before b ON b.proname=p.proname
        WHERE p.pronamespace='public'::regnamespace AND pg_get_functiondef(p.oid)=b.definition) <> 2 THEN
        RAISE EXCEPTION 'Funções da migração divergem da instalação.';
    END IF;
    IF (SELECT count(*) FROM pg_trigger
        WHERE tgname IN ('trg_notify_pev_status_change','trg_notify_collection_schedule_change')
          AND NOT tgisinternal) <> 2 THEN
        RAISE EXCEPTION 'Migração não instalou as duas triggers.';
    END IF;
    IF NOT has_table_privilege('olius_api','public.notification','SELECT')
       OR NOT has_column_privilege('olius_api','public.notification','read_at','UPDATE')
       OR has_table_privilege('olius_api','public.notification','INSERT')
       OR has_column_privilege('olius_api','public.notification','message','UPDATE') THEN
        RAISE EXCEPTION 'Permissões da migração incompatíveis.';
    END IF;
END $test$;
DROP TABLE notification_function_before,notification_catalog_before,notification_columns_before;
\echo 'PASS: notification migration under non-superuser owner, definitions, permissions and catalog parity'
