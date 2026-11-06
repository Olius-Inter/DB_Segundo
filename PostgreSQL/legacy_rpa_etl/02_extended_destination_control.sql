/* Instalação única, após 01_destination_control.sql, somente no destino autorizado.
   Não concede acesso à Core. Não contém senhas, documentos ou tokens. */
BEGIN;
DO $$ BEGIN
    IF (SELECT nspowner FROM pg_namespace WHERE nspname='olius_etl')
        IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='olius_owner') THEN
        RAISE EXCEPTION 'Instalar/revisar controle ETL anterior antes de continuar.';
    END IF;
END $$;
CREATE TABLE olius_etl.establishment_import (
    source_system TEXT NOT NULL CHECK(btrim(source_system)<>''),
    source_id TEXT NOT NULL CHECK(btrim(source_id)<>''),
    destination_id UUID NOT NULL UNIQUE REFERENCES public.establishment(id) ON DELETE RESTRICT,
    source_fingerprint BYTEA NOT NULL CHECK(octet_length(source_fingerprint)=32),
    first_run_id UUID NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(source_system,source_id)
);
CREATE TABLE olius_etl.driver_import (
    source_system TEXT NOT NULL CHECK(btrim(source_system)<>''),
    source_id TEXT NOT NULL CHECK(btrim(source_id)<>''),
    destination_id UUID NOT NULL UNIQUE REFERENCES public.driver(id) ON DELETE RESTRICT,
    source_fingerprint BYTEA NOT NULL CHECK(octet_length(source_fingerprint)=32),
    first_run_id UUID NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(source_system,source_id)
);
ALTER TABLE olius_etl.establishment_import OWNER TO olius_owner;
ALTER TABLE olius_etl.driver_import OWNER TO olius_owner;
REVOKE ALL ON olius_etl.establishment_import,olius_etl.driver_import FROM PUBLIC;
COMMENT ON TABLE olius_etl.establishment_import IS
'Proveniência B2B; reenvio não substitui senha definida pela Core nem edições do cadastro.';
COMMENT ON TABLE olius_etl.driver_import IS
'Proveniência de motorista operacional; não cria conta de autenticação.';
COMMIT;
