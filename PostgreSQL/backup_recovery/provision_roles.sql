-- Pré-requisito GLOBAL: revisar no servidor destino antes de executar.
-- Não depende de tabelas; NÃO substitui access_control/01_roles.sql.
-- Rodar como administrador CREATEROLE autorizado a administrar estes grupos.
-- Não altera senhas nem atributos de papéis existentes.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE n text; r record; inherit_expected boolean; created_here boolean;
BEGIN
    FOREACH n IN ARRAY ARRAY['olius_owner','olius_reader','olius_auditor',
        'olius_catalog_editor','olius_api','olius_ranking_reader','olius_auth_owner',
        'olius_business_owner','olius_dm_owner','olius_bi_reader_role','olius_bi_refresh_role'] LOOP
        inherit_expected := n NOT IN ('olius_dm_owner','olius_bi_reader_role','olius_bi_refresh_role');
        SELECT * INTO r FROM pg_roles WHERE rolname=n;
        created_here := NOT FOUND;
        IF NOT FOUND THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN %s NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
                n,CASE WHEN inherit_expected THEN 'INHERIT' ELSE 'NOINHERIT' END);
        ELSIF r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
            OR r.rolreplication OR r.rolbypassrls OR r.rolinherit<>inherit_expected THEN
            RAISE EXCEPTION 'Papel % incompatível: revisar sem modificar automaticamente',n;
        END IF;
        -- Não elevar silenciosamente uma membership existente.
        IF NOT pg_has_role(current_user,n,'SET') OR NOT pg_has_role(current_user,n,'USAGE') THEN
            IF NOT created_here AND EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid=n::regrole
                       AND member=current_user::regrole) THEN
                RAISE EXCEPTION 'Membership de % precisa de revisão (SET/INHERIT)',n;
            END IF;
            EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE, SET TRUE',n,current_user);
            RAISE NOTICE 'Membership administrativa adicionada: % -> %. Registrar e revogar após validação se temporária.',n,current_user;
        END IF;
    END LOOP;
END $$;
COMMIT;
