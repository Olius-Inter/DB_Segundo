-- Executar no DESTINO, na mesma sessão/transação do dump e finish_restore.sql.
-- Os papéis e memberships globais já devem existir (ver guia).
\set ON_ERROR_STOP on
SELECT set_config('olius.recovery_source', :'source_database', false);
DO $$
BEGIN
    IF current_database() = current_setting('olius.recovery_source') THEN
        RAISE EXCEPTION 'O destino deve ter nome diferente da origem';
    END IF;
END $$;

CREATE TEMP TABLE recovery_temporary_grants (
    scope text, role_name name, PRIMARY KEY(scope, role_name)
) ON COMMIT DROP;

DO $$
DECLARE r text;
        maintenance_owner CONSTANT text := 'olius_owner';
        mart_owner CONSTANT text := 'olius_dm_owner';
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f'))
       OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='dm') THEN
        RAISE EXCEPTION 'Destino não vazio: crie um banco novo com template0';
    END IF;
    FOREACH r IN ARRAY ARRAY[maintenance_owner,'olius_auth_owner','olius_business_owner',mart_owner] LOOP
        IF NOT pg_has_role(current_user,r,'SET') OR NOT pg_has_role(current_user,r,'USAGE') THEN
            RAISE EXCEPTION 'Administrador precisa de SET e INHERIT no papel %',r;
        END IF;
        IF NOT has_schema_privilege(r,'public','CREATE') THEN
            -- olius_owner tem CREATE permanente na política oficial do OLIUS.
            IF r <> maintenance_owner THEN
                INSERT INTO recovery_temporary_grants VALUES ('schema',r);
            END IF;
            EXECUTE format('GRANT CREATE ON SCHEMA public TO %I',r);
        END IF;
    END LOOP;
    -- ALTER SCHEMA dm OWNER exige CREATE no banco para o novo proprietário.
    IF NOT has_database_privilege(mart_owner,current_database(),'CREATE') THEN
        INSERT INTO recovery_temporary_grants VALUES ('database',mart_owner);
        EXECUTE format('GRANT CREATE ON DATABASE %I TO %I',current_database(),mart_owner);
    END IF;
END $$;
