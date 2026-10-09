\set ON_ERROR_STOP on
-- Somente banco descartável. Cada chamada deve falhar com o SQLSTATE indicado.
BEGIN;
\ir fixtures_procedures.sql

DO $$
DECLARE missing UUID := gen_random_uuid();
BEGIN
    PERFORM olius_test.expect_error(format('SELECT * FROM get_cycle_availability(%L)', missing), 'P0002');
    PERFORM olius_test.expect_error(format('SELECT * FROM calculate_collection_score(%L)', missing), 'P0002');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_certificate_progress(%L)', missing), 'P0002');
    PERFORM olius_test.assert((SELECT count(*) = 0 FROM point_calculation), 'consultas inválidas não criam cálculos');
    RAISE NOTICE 'PASS: ciclo, coleta e estabelecimento inexistentes';
END $$;

ROLLBACK;
