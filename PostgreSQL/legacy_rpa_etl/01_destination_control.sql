/* Executar somente no destino autorizado, após estrutura e controle de acesso.
   Controle técnico da importação; não contém senhas, hashes de senha ou CPFs.
   Implantar como administrador autorizado. Não concede acesso à Core ou leitores. */
BEGIN;
CREATE SCHEMA IF NOT EXISTS olius_etl AUTHORIZATION olius_owner;
DO $$ BEGIN
    IF (SELECT nspowner FROM pg_namespace WHERE nspname='olius_etl')
        <> (SELECT oid FROM pg_roles WHERE rolname='olius_owner') THEN
        RAISE EXCEPTION 'Schema ETL existente com outro proprietario; revisar.';
    END IF;
END $$;
REVOKE ALL ON SCHEMA olius_etl FROM PUBLIC;
CREATE TABLE olius_etl.citizen_import (
    source_system TEXT NOT NULL,
    source_user_id TEXT NOT NULL,
    source_citizen_id TEXT NOT NULL,
    destination_user_id UUID NOT NULL UNIQUE REFERENCES public.citizens(id) ON DELETE RESTRICT,
    source_fingerprint BYTEA NOT NULL CHECK(octet_length(source_fingerprint)=32),
    original_registration_date DATE NOT NULL CHECK(isfinite(original_registration_date)),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    first_run_id UUID NOT NULL,
    PRIMARY KEY(source_system,source_user_id),
    UNIQUE(source_system,source_citizen_id),
    CHECK(btrim(source_system)<>'' AND btrim(source_user_id)<>'' AND btrim(source_citizen_id)<>'')
);
ALTER TABLE olius_etl.citizen_import OWNER TO olius_owner;
REVOKE ALL ON olius_etl.citizen_import FROM PUBLIC;
GRANT USAGE ON SCHEMA olius_etl TO olius_owner;
COMMENT ON TABLE olius_etl.citizen_import IS
'Proveniência B2C confirmada na mesma transação do cadastro; reenvios não reescrevem o usuário.';
COMMIT;
