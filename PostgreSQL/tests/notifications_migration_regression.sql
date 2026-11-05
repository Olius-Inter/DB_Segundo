\set ON_ERROR_STOP on
-- O runner exige uma base vazia e descartável antes da instalação.
-- Recria somente os objetos novos para exercitar a migração antes do profiler.
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

DROP FUNCTION public.notify_pev_status_change() CASCADE;
DROP FUNCTION public.notify_collection_schedule_change() CASCADE;
DROP TABLE public.notification;

-- A migração inteira executa sob o proprietário NOLOGIN sem SUPERUSER.
SET SESSION AUTHORIZATION olius_owner;
\ir ../migrations/20261104_notifications.sql
RESET SESSION AUTHORIZATION;

DO $test$
BEGIN
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
DROP TABLE notification_function_before;
\echo 'PASS: notification migration under non-superuser owner, definitions and permissions'
