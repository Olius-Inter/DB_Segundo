-- Mesmo processo psql de prepare_restore.sql e do dump. Não executar isoladamente.
\set ON_ERROR_STOP on
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM recovery_temporary_grants LOOP
        IF r.scope='schema' THEN
            EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I',r.role_name);
        ELSE
            EXECUTE format('REVOKE CREATE ON DATABASE %I FROM %I',current_database(),r.role_name);
        END IF;
    END LOOP;
    -- Sem --create, pg_dump não inclui ACL do próprio banco. Repor o contrato
    -- CONNECT da versão OLIUS desta branch, sem executar 01_roles antes dos objetos.
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO olius_owner, olius_reader, olius_auditor, olius_catalog_editor, olius_api, olius_ranking_reader, olius_dm_owner, olius_bi_reader_role, olius_bi_refresh_role',current_database());
END $$;
