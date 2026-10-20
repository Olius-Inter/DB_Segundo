/* OLIUS — Conferência independente do contrato oficial inicial.
   Somente leitura; aceita outros registros legítimos e IDs preexistentes.
   Descrições/imagens opcionais não especificadas no contrato são preservadas.
   Este contrato de validação repete os valores esperados para detectar desvios.
*/
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public, pg_temp;
DO $validate_reference_data$
DECLARE
    catalogs CONSTANT JSONB := $catalogs${
    "subscription_plan": [
        {
            "name": "Plano Básico",
            "monthly_price": 19.9,
            "volume_limit_liters": 50,
            "collection_limit": 2,
            "status": "ACTIVE"
        },
        {
            "name": "Plano Profissional",
            "monthly_price": 39.9,
            "volume_limit_liters": 220,
            "collection_limit": 4,
            "status": "ACTIVE"
        },
        {
            "name": "Plano Empresa",
            "monthly_price": 79.9,
            "volume_limit_liters": 500,
            "collection_limit": 8,
            "status": "ACTIVE"
        }
    ],
    "certificate_level": [
        {
            "name": "Óleo Amigo — Bronze",
            "required_liters": 100
        },
        {
            "name": "Óleo Amigo — Prata",
            "required_liters": 500
        },
        {
            "name": "Óleo Amigo — Ouro",
            "required_liters": 1000
        }
    ],
    "establishment_type": [
        {
            "name": "Restaurante"
        },
        {
            "name": "Lanchonete"
        },
        {
            "name": "Padaria e confeitaria"
        },
        {
            "name": "Bar"
        },
        {
            "name": "Hotel e pousada"
        },
        {
            "name": "Cozinha institucional"
        },
        {
            "name": "Outro"
        }
    ],
    "collection_failure_reason": [
        {
            "code": "VOLUME_OUT_OF_TOLERANCE",
            "name": "Volume fora da tolerância",
            "description": "Volume efetivamente recolhido fora da tolerância definida para a solicitação.",
            "status": "ACTIVE"
        },
        {
            "code": "OIL_UNACCEPTABLE",
            "name": "Óleo em condição inadequada",
            "description": "Condição inadequada do óleo registrada na coleta malsucedida.",
            "status": "ACTIVE"
        },
        {
            "code": "COMPROMISING_OCCURRENCE",
            "name": "Ocorrência que comprometeu a coleta",
            "description": "Ocorrência comprometedora registrada na coleta malsucedida.",
            "status": "ACTIVE"
        }
    ]
}$catalogs$::JSONB;
    catalog RECORD;
    item JSONB;
    key_column TEXT;
    key_value TEXT;
    existing_count BIGINT;
    existing_row JSONB;
BEGIN
    FOR catalog IN SELECT key AS table_name, value AS rows FROM jsonb_each(catalogs) ORDER BY key LOOP
        key_column := CASE WHEN catalog.table_name = 'collection_failure_reason' THEN 'code' ELSE 'name' END;
        FOR item IN SELECT value FROM jsonb_array_elements(catalog.rows) LOOP
            key_value := item ->> key_column;
            EXECUTE format('SELECT count(*), (jsonb_agg(to_jsonb(t)))->0 FROM public.%I t WHERE %I = $1',
                           catalog.table_name, key_column)
                INTO existing_count, existing_row USING key_value;
            IF existing_count <> 1 OR NOT COALESCE(existing_row @> item, FALSE) THEN
                RAISE EXCEPTION 'Validação inicial: registro ausente, duplicado ou divergente em % (%).',
                    catalog.table_name, key_value;
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Configuração oficial validada: 3 planos, 3 níveis, 7 tipos e 3 motivos (16 registros).';
END;
$validate_reference_data$;
COMMIT;
