-- Helpers temporários da carga: não acrescentam tabelas ou rotinas à aplicação.
CREATE TEMP TABLE dl_config AS SELECT :'load_config'::JSONB AS value;
CREATE FUNCTION pg_temp.dl_id(kind TEXT, number INTEGER) RETURNS UUID
LANGUAGE SQL IMMUTABLE AS $$ SELECT md5('olius-data-load-v1:' || kind || ':' || number)::UUID $$;
CREATE FUNCTION pg_temp.dl_assert(condition BOOLEAN, explanation TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$ BEGIN
    IF condition IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Data Load: %', explanation; END IF;
END $$;
CREATE FUNCTION pg_temp.dl_actor(actor TEXT, user_id UUID DEFAULT NULL, driver_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
    PERFORM set_config('app.audit_actor', actor, TRUE);
    PERFORM set_config('app.current_user_id', COALESCE(user_id::TEXT, ''), TRUE);
    PERFORM set_config('app.operational_driver_id', COALESCE(driver_id::TEXT, ''), TRUE);
    PERFORM set_config('app.audit_reason', 'Massa artificial OLIUS Data Load v1', TRUE);
END $$;
-- CPF/CNPJ com dígitos verificadores para dados sintéticos; não comprovam titularidade.
CREATE FUNCTION pg_temp.dl_document(number INTEGER, cnpj BOOLEAN DEFAULT FALSE) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE digits TEXT := lpad((810000000 + number)::TEXT, CASE WHEN cnpj THEN 12 ELSE 9 END, '0');
        weights INTEGER[]; total INTEGER; digit INTEGER; i INTEGER; pass INTEGER;
BEGIN
    FOR pass IN 1..2 LOOP
        weights := CASE WHEN cnpj AND pass=1 THEN ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]
                        WHEN cnpj THEN ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2] END;
        total := 0;
        FOR i IN 1..length(digits) LOOP
            total := total + substring(digits,i,1)::INTEGER *
                CASE WHEN cnpj THEN weights[i] ELSE length(digits)+2-i END;
        END LOOP;
        digit := CASE WHEN total % 11 < 2 THEN 0 ELSE 11-total%11 END;
        digits := digits || digit::TEXT;
    END LOOP;
    RETURN digits;
END $$;
