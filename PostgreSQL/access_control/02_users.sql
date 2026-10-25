/* Contas da equipe, Core API e integração BI — PostgreSQL 16.15.
   Executar SEPARADAMENTE após 01_roles.sql no banco do
   segundo ano. Requer CREATEROLE e ADMIN OPTION nos grupos atribuídos.
   Não altera senhas, contas do Aiven, privilégios de outros bancos.
   Contas novas têm LOGIN, mas nenhuma senha: configure-a fora do arquivo/Git.
   Roles são globais. Nomes preexistentes não gerenciados por este script
   interrompem a transação para evitar apropriar uma conta de outro projeto. */
BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $team_accounts$
DECLARE member_name text; group_name text; account record;
        marker text;
BEGIN
    IF to_regclass('public.data_catalog_role') IS NULL
       OR to_regprocedure('public.open_auth_session(uuid,bytea)') IS NULL
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_owner')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_reader')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_api')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_ranking_reader')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_dm_owner')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_bi_reader_role')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olius_bi_refresh_role') THEN
        RAISE EXCEPTION 'Instale o banco, o catálogo e access_control/01_roles.sql antes das contas.';
    END IF;
    IF (SELECT pg_get_userbyid(relowner) FROM pg_class
        WHERE oid='public.users'::regclass) <> 'olius_owner'
       OR (SELECT pg_get_userbyid(proowner) FROM pg_proc
           WHERE oid='public.open_auth_session(uuid,bytea)'::regprocedure) <> 'olius_auth_owner' THEN
        RAISE EXCEPTION 'Propriedade ainda não configurada; executar 01_roles.sql antes das contas.';
    END IF;

    FOREACH member_name IN ARRAY ARRAY['pedro','caio','matheus','guilherme','david','erick','olius_core_api','olius_dm_admin','olius_bi_reader','olius_bi_refresh','olius_redis_api'] LOOP
        group_name := CASE WHEN member_name IN ('pedro','caio') THEN 'olius_owner'
                           WHEN member_name='olius_core_api' THEN 'olius_api'
                           WHEN member_name='olius_redis_api' THEN 'olius_ranking_reader'
                           WHEN member_name='olius_dm_admin' THEN 'olius_dm_owner'
                           WHEN member_name='olius_bi_reader' THEN 'olius_bi_reader_role'
                           WHEN member_name='olius_bi_refresh' THEN 'olius_bi_refresh_role'
                           ELSE 'olius_reader' END;
        -- Preserva a marca das contas pessoais já provisionadas.
        marker := CASE WHEN member_name='olius_core_api'
                       THEN 'OLIUS: conta técnica da Core gerenciada por access_control/02_users.sql'
                       WHEN member_name='olius_redis_api'
                       THEN 'OLIUS: conta técnica da API Redis gerenciada por access_control/02_users.sql'
                       WHEN member_name='olius_dm_admin'
                       THEN 'OLIUS: conta de manutenção do Data Mart gerenciada por access_control/02_users.sql'
                       WHEN member_name IN ('olius_bi_reader','olius_bi_refresh')
                       THEN 'OLIUS: conta técnica BI gerenciada por access_control/02_users.sql'
                       ELSE 'OLIUS: conta individual gerenciada por data_catalog/08_users.sql' END;
        SELECT * INTO account FROM pg_roles WHERE rolname=member_name;
        IF FOUND THEN
            IF shobj_description(account.oid,'pg_authid') IS DISTINCT FROM marker THEN
                RAISE EXCEPTION 'Conta % já existe e não foi gerenciada por este script. Revisar colisão de nomes; nenhuma conta será reaproveitada automaticamente.',member_name;
            END IF;
            IF NOT account.rolcanlogin OR NOT account.rolinherit OR account.rolsuper
               OR account.rolcreatedb OR account.rolcreaterole
               OR account.rolreplication OR account.rolbypassrls THEN
                RAISE EXCEPTION 'Conta % com atributos incompatíveis; revisar antes de reaplicar.',member_name;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid
                       WHERE m.member=account.oid AND (r.rolname<>group_name OR m.admin_option)) THEN
                RAISE EXCEPTION 'Conta % com membership extra ou delegação administrativa; revisar.',member_name;
            END IF;
        ELSE
            EXECUTE format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',member_name);
            EXECUTE format('COMMENT ON ROLE %I IS %L',member_name,marker);
        END IF;
        -- INHERIT dá os acessos do grupo; SET permite criar objetos como owner.
        -- ADMIN FALSE impede delegar o grupo a outras pessoas.
        EXECUTE format('GRANT %I TO %I WITH ADMIN FALSE, INHERIT TRUE, SET TRUE',group_name,member_name);
    END LOOP;
END $team_accounts$;

COMMIT;

SELECT member.rolname AS login, granted.rolname AS role_name,
       m.inherit_option, m.set_option, m.admin_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles member ON member.oid=m.member
JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
WHERE member.rolname IN ('pedro','caio','matheus','guilherme','david','erick','olius_core_api','olius_dm_admin','olius_bi_reader','olius_bi_refresh','olius_redis_api')
ORDER BY login,role_name;

-- Visibilidade de CONNECT em todos os bancos do servidor. PUBLIC pode conceder
-- conexão mesmo sem membership OLIUS. Apenas relata; NÃO modifica outro banco.
-- CONNECT não implica acesso aos dados, e autenticação/rede também são exigidas.
SELECT r.rolname AS login, d.datname AS database_name,
       pg_catalog.has_database_privilege(r.oid,d.oid,'CONNECT') AS can_connect
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_database d
WHERE r.rolname IN ('pedro','caio','matheus','guilherme','david','erick','olius_core_api','olius_dm_admin','olius_bi_reader','olius_bi_refresh','olius_redis_api')
  AND d.datallowconn AND NOT d.datistemplate
ORDER BY login,database_name;
