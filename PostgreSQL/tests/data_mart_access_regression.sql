-- Banco descartável: instalar 01..08, catálogo e access_control antes.
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;
\ir fixtures_procedures.sql
GRANT USAGE ON SCHEMA olius_test TO olius_bi_reader, olius_bi_refresh, olius_dm_admin;

DO $$
DECLARE req UUID; c UUID; d UUID;
BEGIN
    req := olius_test.request();
    CALL public.record_collection(req,olius_test.id('driver'),10,10,'ACCEPTABLE',FALSE,
        ARRAY[]::TEXT[],NULL,clock_timestamp(),c);
    CALL public.record_pev_delivery(gen_random_uuid(),olius_test.id('citizen'),olius_test.id('pev'),
        olius_test.id('validator'),25,clock_timestamp(),d);
END $$;

SET LOCAL SESSION AUTHORIZATION olius_bi_reader;
SELECT COUNT(*) FROM dm.fato_coleta;
SELECT COUNT(*) FROM dm.ranking_anual;
SELECT snapshot_id FROM dm.refresh_state;
SELECT olius_test.expect_error('SELECT * FROM public.users','42501');
SELECT olius_test.expect_error('SELECT * FROM public.collection','42501');
SELECT olius_test.expect_error('CALL dm.refresh_data_mart()','42501');
SELECT olius_test.expect_error('REFRESH MATERIALIZED VIEW dm.fato_coleta','42501');
SELECT olius_test.expect_error('UPDATE dm.refresh_state SET refreshed_at=now()','42501');
SELECT olius_test.expect_error('SET ROLE olius_dm_owner','42501');
SELECT olius_test.expect_error('CREATE TABLE dm.forbidden(id integer)','42501');
RESET SESSION AUTHORIZATION;

-- Administração separada das contas de consulta/refresh, sem acesso administrativo global.
SET LOCAL SESSION AUTHORIZATION olius_dm_admin;
SELECT COUNT(*) FROM dm.fato_coleta;
CALL dm.refresh_data_mart();
SET LOCAL ROLE olius_dm_owner;
CREATE TABLE dm.admin_ownership_probe(id INTEGER);
RESET ROLE;
SELECT olius_test.assert(
    (SELECT pg_get_userbyid(relowner)='olius_dm_owner' FROM pg_class
     WHERE oid='dm.admin_ownership_probe'::regclass),
    'objetos de manutenção pertencem ao grupo dm_owner');
DROP TABLE dm.admin_ownership_probe;
SELECT olius_test.expect_error('SELECT password_hash FROM public.users','42501');
SELECT olius_test.expect_error('UPDATE public.collection SET points_earned=123','42501');
SELECT olius_test.expect_error('SET ROLE olius_owner','42501');
RESET SESSION AUTHORIZATION;

SET LOCAL SESSION AUTHORIZATION olius_bi_refresh;
CALL dm.refresh_data_mart();
SELECT snapshot_id FROM dm.refresh_state;
SELECT olius_test.expect_error('SELECT * FROM dm.fato_coleta','42501');
SELECT olius_test.expect_error('SELECT * FROM public.collection','42501');
SELECT olius_test.expect_error('UPDATE dm.refresh_state SET refreshed_at=now()','42501');
SELECT olius_test.expect_error('SET ROLE olius_dm_owner','42501');
RESET SESSION AUTHORIZATION;

SELECT olius_test.assert(
    (SELECT COUNT(*) FROM dm.fato_coleta)=1 AND (SELECT COUNT(*) FROM dm.fato_entrega_pev)=1,
    'refresh autorizado carrega operações');
SELECT olius_test.assert(NOT EXISTS (
    (SELECT perfil,ano,participante_id,pontos_anuais,posicao FROM dm.ranking_anual
     EXCEPT SELECT profile,ranking_year,participant_id::TEXT,annual_points,ranking_position FROM public.vw_annual_ranking)
    UNION ALL
    (SELECT profile,ranking_year,participant_id::TEXT,annual_points,ranking_position FROM public.vw_annual_ranking
     EXCEPT SELECT perfil,ano,participante_id,pontos_anuais,posicao FROM dm.ranking_anual)
),'ranking materializado preserva o contrato aprovado');

-- Anulação deve desaparecer da próxima fotografia, inclusive do ranking.
DO $$
DECLARE item RECORD;
BEGIN
    FOR item IN SELECT id, revision FROM public.collection LOOP
        CALL public.correct_collection(item.id, item.revision, olius_test.id('admin'),
            'ANNULLED', NULL, NULL, NULL, NULL, ARRAY[]::TEXT[], NULL,
            'Anulação para validar a próxima fotografia do Data Mart');
    END LOOP;
END $$;
CALL dm.refresh_data_mart();
SELECT olius_test.assert(NOT EXISTS(SELECT 1 FROM dm.fato_coleta), 'anulação removida da fato');
SELECT olius_test.assert(NOT EXISTS(SELECT 1 FROM dm.ranking_anual WHERE perfil='B2B'), 'anulação removida do ranking');
ROLLBACK;
