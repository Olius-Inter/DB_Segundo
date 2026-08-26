/*
===============================================================================
PROJETO.............: ÓLEO AMIGO
BANCO DE DADOS......: PostgreSQL
SCRIPT..............: 02 - CHECK Constraints
PARTE...............: 1/3

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script adiciona as regras de negócio implementadas através de
CHECK CONSTRAINTS nas tabelas:

• users
• citizens
• establishment
• telephone
• addresses

OBSERVAÇÕES
-------------------------------------------------------------------------------
- As CHECK Constraints garantem a integridade dos dados diretamente no banco.
- Validações complexas (como algoritmo do CPF ou formato completo de e-mail)
  serão implementadas posteriormente através de Functions ou na aplicação.

===============================================================================
*/

-- ============================================================================
-- USERS
-- ============================================================================

ALTER TABLE users
ADD CONSTRAINT ck_users_name_not_blank
CHECK (TRIM(name) <> '');

ALTER TABLE users
ADD CONSTRAINT ck_users_email_not_blank
CHECK (TRIM(email) <> '');

ALTER TABLE users
ADD CONSTRAINT ck_users_email_format
CHECK (POSITION('@' IN email) > 1);


-- ============================================================================
-- CITIZENS
-- ============================================================================

ALTER TABLE citizens
ADD CONSTRAINT ck_citizens_cpf_length
CHECK (LENGTH(cpf) = 11);


-- ============================================================================
-- ESTABLISHMENT
-- ============================================================================

ALTER TABLE establishment
ADD CONSTRAINT ck_establishment_cnpj_length
CHECK (LENGTH(cnpj) = 14);

ALTER TABLE establishment
ADD CONSTRAINT ck_establishment_qr_token_not_blank
CHECK (TRIM(qr_token) <> '');


-- ============================================================================
-- TELEPHONE
-- ============================================================================

ALTER TABLE telephone
ADD CONSTRAINT ck_telephone_length
CHECK (LENGTH(telephone) BETWEEN 10 AND 15);


-- ============================================================================
-- ADDRESSES
-- ============================================================================

ALTER TABLE addresses
ADD CONSTRAINT ck_addresses_state_length
CHECK (LENGTH(state) = 2);

ALTER TABLE addresses
ADD CONSTRAINT ck_addresses_cep_length
CHECK (LENGTH(cep) = 8);

ALTER TABLE addresses
ADD CONSTRAINT ck_addresses_latitude
CHECK (
    latitude IS NULL
    OR
    latitude BETWEEN -90 AND 90
);

ALTER TABLE addresses
ADD CONSTRAINT ck_addresses_longitude
CHECK (
    longitude IS NULL
    OR
    longitude BETWEEN -180 AND 180
);

/*
===============================================================================
PROJETO.............: ÓLEO AMIGO
BANCO DE DADOS......: PostgreSQL
SCRIPT..............: 02 - CHECK Constraints
PARTE...............: 2/3

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script adiciona as CHECK Constraints das tabelas:

• driver
• pev

===============================================================================
*/

-- ============================================================================
-- DRIVER
-- ============================================================================

ALTER TABLE driver
ADD CONSTRAINT ck_driver_name_not_blank
CHECK (TRIM(name) <> '');

ALTER TABLE driver
ADD CONSTRAINT ck_driver_cpf_length
CHECK (LENGTH(cpf) = 11);

ALTER TABLE driver
ADD CONSTRAINT ck_driver_cnh_length
CHECK (LENGTH(cnh) = 11);

ALTER TABLE driver
ADD CONSTRAINT ck_driver_updated_at
CHECK (updated_at >= registration_date);


-- ============================================================================
-- PEV
-- ============================================================================

-- Apenas UM proprietário pode existir.
-- Um PEV pertence OU a um cidadão OU a um estabelecimento.

ALTER TABLE pev
ADD CONSTRAINT ck_pev_single_owner
CHECK (
    (
        citizen_id IS NOT NULL
        AND
        establishment_id IS NULL
    )
    OR
    (
        citizen_id IS NULL
        AND
        establishment_id IS NOT NULL
    )
);

-- Se o PEV estiver aprovado,
-- obrigatoriamente deve existir data de aprovação.

ALTER TABLE pev
ADD CONSTRAINT ck_pev_approved_at
CHECK (
    (
        status = 'APPROVED'
        AND
        approved_at IS NOT NULL
    )
    OR
    (
        status <> 'APPROVED'
        AND
        approved_at IS NULL
    )
);

-- A data de aprovação nunca pode ser anterior ao cadastro.

ALTER TABLE pev
ADD CONSTRAINT ck_pev_approval_date
CHECK (
    approved_at IS NULL
    OR
    approved_at >= created_at
);

/*
===============================================================================
PROJETO.............: ÓLEO AMIGO
BANCO DE DADOS......: PostgreSQL
SCRIPT..............: 02 - CHECK Constraints
PARTE...............: 3/3

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script adiciona as CHECK Constraints das tabelas:

• collection_request
• collection
• delivery_pev
• certificate_level
• certificate

===============================================================================
*/

-- ============================================================================
-- COLLECTION_REQUEST
-- ============================================================================

ALTER TABLE collection_request
ADD CONSTRAINT ck_collection_request_positive_volume
CHECK (estimated_volume_liters > 0);

ALTER TABLE collection_request
ADD CONSTRAINT ck_collection_request_updated_at
CHECK (updated_at >= request_at);


-- ============================================================================
-- COLLECTION
-- ============================================================================

ALTER TABLE collection
ADD CONSTRAINT ck_collection_positive_volume
CHECK (collected_volume_liters > 0);

ALTER TABLE collection
ADD CONSTRAINT ck_collection_created_at
CHECK (created_at <= collection_date);

-- Uma coleta só concede pontos quando está vinculada a uma solicitação
-- (e, portanto, a um estabelecimento). Coletas sem solicitação prévia
-- (ex.: rota de esvaziamento de PEV) não possuem estabelecimento a
-- quem atribuir pontos.

ALTER TABLE collection
ADD CONSTRAINT ck_collection_points_earned_establishment
CHECK (
    (
        collection_request_id IS NOT NULL
        AND
        points_earned IS NOT NULL
    )
    OR
    (
        collection_request_id IS NULL
        AND
        points_earned IS NULL
    )
);

ALTER TABLE collection
ADD CONSTRAINT ck_collection_points_earned_non_negative
CHECK (
    points_earned IS NULL
    OR
    points_earned >= 0
);


-- ============================================================================
-- DELIVERY_PEV
-- ============================================================================

ALTER TABLE delivery_pev
ADD CONSTRAINT ck_delivery_pev_positive_volume
CHECK (oil_volume_liters > 0);

ALTER TABLE delivery_pev
ADD CONSTRAINT ck_delivery_pev_positive_points
CHECK (points_earned >= 0);

ALTER TABLE delivery_pev
ADD CONSTRAINT ck_delivery_pev_created_at
CHECK (created_at <= delivery_date);


-- ============================================================================
-- CERTIFICATE_LEVEL
-- ============================================================================

ALTER TABLE certificate_level
ADD CONSTRAINT ck_certificate_level_name_not_blank
CHECK (TRIM(name) <> '');

ALTER TABLE certificate_level
ADD CONSTRAINT ck_certificate_level_positive_liters
CHECK (required_liters > 0);

ALTER TABLE certificate_level
ADD CONSTRAINT ck_certificate_level_updated_at
CHECK (updated_at >= created_at);


-- ============================================================================
-- CERTIFICATE
-- ============================================================================

ALTER TABLE certificate
ADD CONSTRAINT ck_certificate_code_not_blank
CHECK (TRIM(certificate_code) <> '');

ALTER TABLE certificate
ADD CONSTRAINT ck_certificate_created_at
CHECK (created_at <= issued_at);