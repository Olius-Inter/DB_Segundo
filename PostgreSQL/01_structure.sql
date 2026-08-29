/*
===============================================================================
PROJETO.............: ÓLEO AMIGO
BANCO DE DADOS......: PostgreSQL
SCRIPT..............: 01 - Estrutura do Banco de Dados
PARTE...............: 1/3

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script contém:

• Habilitação da extensão pgcrypto
• Criação dos ENUMs
• Criação das primeiras tabelas do sistema

OBSERVAÇÃO
-------------------------------------------------------------------------------
Todas as chaves primárias utilizam UUID com geração automática através da
função gen_random_uuid().

Essa abordagem é amplamente utilizada em ambientes de produção por:

• Evitar colisão de identificadores;
• Não depender da aplicação para gerar IDs;
• Facilitar integrações futuras;
• Melhorar escalabilidade.

Caso a extensão não esteja instalada, execute este script utilizando um
usuário com privilégios suficientes.

===============================================================================
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_type_t AS ENUM (
    'ESTABLISHMENT',
    'CITIZENS',
    'ADMIN'
);

CREATE TYPE active_status_t AS ENUM (
    'ACTIVE',
    'INACTIVE'
);

CREATE TYPE approval_status_t AS ENUM (
    'PENDING',
    'APPROVED',
    'INACTIVE',
    'REJECTED'
);

CREATE TYPE request_status_t AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);

CREATE TYPE operation_status_t AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
);

-- ============================================================================
-- TABELA: users
-- ============================================================================

CREATE TABLE users (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name VARCHAR(150)
        NOT NULL,

    email VARCHAR(255)
        NOT NULL
        UNIQUE,

    password_hash VARCHAR(255)
        NOT NULL,

    user_type user_type_t
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS
'Tabela responsável por armazenar todos os usuários do sistema.';

-- ============================================================================
-- TABELA: establishment_type
-- ============================================================================

CREATE TABLE establishment_type (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name VARCHAR(100)
        NOT NULL
        UNIQUE,

    description VARCHAR(255)
);

COMMENT ON TABLE establishment_type IS
'Tipos de estabelecimentos cadastrados no sistema.';

-- ============================================================================
-- TABELA: addresses
-- ============================================================================

CREATE TABLE addresses (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    state CHAR(2)
        NOT NULL,

    city VARCHAR(100)
        NOT NULL,

    neighborhood VARCHAR(100)
        NOT NULL,

    street VARCHAR(150)
        NOT NULL,

    number VARCHAR(20)
        NOT NULL,

    cep CHAR(8)
        NOT NULL,

    complement VARCHAR(150),

    latitude DECIMAL(9,6),

    longitude DECIMAL(9,6)
);

COMMENT ON TABLE addresses IS
'Endereços utilizados pelo sistema.';

-- ============================================================================
-- TABELA: telephone
-- ============================================================================

CREATE TABLE telephone (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    telephone VARCHAR(20)
        NOT NULL
        UNIQUE,

    user_id UUID
        NOT NULL,

    CONSTRAINT fk_telephone_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

COMMENT ON TABLE telephone IS
'Telefones vinculados aos usuários do sistema.';

-- ============================================================================
-- TABELA: citizens
-- ============================================================================

CREATE TABLE citizens (

    id UUID PRIMARY KEY,

    cpf CHAR(11)
        NOT NULL
        UNIQUE,

    qr_token VARCHAR(64)
        NOT NULL
        UNIQUE,

    points INTEGER
        NOT NULL
        DEFAULT 0,

    CONSTRAINT fk_citizens_user
        FOREIGN KEY (id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

COMMENT ON TABLE citizens IS
'Especialização da tabela users para cidadãos. O campo points armazena a pontuação acumulada (desnormalização intencional; histórico em delivery_pev.points_earned).';

-- ============================================================================
-- TABELA: establishment
-- ============================================================================

CREATE TABLE establishment (

    id UUID PRIMARY KEY,

    cnpj CHAR(14)
        NOT NULL
        UNIQUE,

    description TEXT,

    is_pev BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    qr_token VARCHAR(64)
        NOT NULL
        UNIQUE,

    type_id UUID
        NOT NULL,

    address_id UUID
        NOT NULL
        UNIQUE,

    points INTEGER
        NOT NULL
        DEFAULT 0,

    CONSTRAINT fk_establishment_user
        FOREIGN KEY (id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_establishment_type
        FOREIGN KEY (type_id)
        REFERENCES establishment_type(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_establishment_address
        FOREIGN KEY (address_id)
        REFERENCES addresses(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

COMMENT ON TABLE establishment IS
'Especialização da tabela users para estabelecimentos. O campo points armazena a pontuação acumulada (desnormalização intencional; histórico em collection.points_earned).';

/*
===============================================================================
SCRIPT..............: 01 - Estrutura do Banco de Dados
PARTE...............: 2/3

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script contém:

• Tabela driver
• Tabela pev
• Tabela collection_request
• Tabela collection
• Tabela delivery_pev
• Tabela certificate_level
• Tabela certificate

===============================================================================
*/

-- ============================================================================
-- TABELA: driver
-- ============================================================================

CREATE TABLE driver (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name VARCHAR(150)
        NOT NULL,

    cpf CHAR(11)
        NOT NULL
        UNIQUE,

    cnh CHAR(11)
        NOT NULL
        UNIQUE,

    registration_date TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    status active_status_t
        NOT NULL
);

COMMENT ON TABLE driver IS
'Motoristas responsáveis pelas coletas de óleo.';


-- ============================================================================
-- TABELA: pev
-- ============================================================================

CREATE TABLE pev (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    status approval_status_t
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    approved_at TIMESTAMP,

    approved_by UUID,

    citizen_id UUID
        UNIQUE,

    establishment_id UUID
        UNIQUE,

    address_id UUID
        NOT NULL
        UNIQUE,

    CONSTRAINT fk_pev_citizen
        FOREIGN KEY (citizen_id)
        REFERENCES citizens(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_pev_establishment
        FOREIGN KEY (establishment_id)
        REFERENCES establishment(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_pev_address
        FOREIGN KEY (address_id)
        REFERENCES addresses(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_pev_user
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

COMMENT ON TABLE pev IS
'Pontos de Entrega Voluntária cadastrados no sistema.';


-- ============================================================================
-- TABELA: collection_request
-- ============================================================================

CREATE TABLE collection_request (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    estimated_volume_liters DECIMAL(8,2)
        NOT NULL,

    status request_status_t
        NOT NULL,

    observation TEXT,

    request_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    establishment_id UUID
        NOT NULL,

    approved_by UUID,

    CONSTRAINT fk_collection_request_establishment
        FOREIGN KEY (establishment_id)
        REFERENCES establishment(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_collection_request_user
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

COMMENT ON TABLE collection_request IS
'Solicitações de coleta realizadas pelos estabelecimentos.';


-- ============================================================================
-- TABELA: collection
-- ============================================================================

CREATE TABLE collection (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    collected_volume_liters DECIMAL(8,2)
        NOT NULL,

    points_earned INTEGER,

    observation TEXT,

    collection_date TIMESTAMP
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    collection_request_id UUID
        UNIQUE,

    driver_id UUID
        NOT NULL,

    CONSTRAINT fk_collection_request
        FOREIGN KEY (collection_request_id)
        REFERENCES collection_request(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_collection_driver
        FOREIGN KEY (driver_id)
        REFERENCES driver(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

COMMENT ON TABLE collection IS
'Coletas efetivamente realizadas pelos motoristas. Quando vinculada a uma collection_request, concede pontos ao estabelecimento solicitante.';


-- ============================================================================
-- TABELA: delivery_pev
-- ============================================================================

CREATE TABLE delivery_pev (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    oil_volume_liters DECIMAL(8,2)
        NOT NULL,

    points_earned INTEGER
        NOT NULL,

    delivery_date TIMESTAMP
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    citizen_id UUID
        NOT NULL,

    pev_id UUID
        NOT NULL,

    CONSTRAINT fk_delivery_pev_citizen
        FOREIGN KEY (citizen_id)
        REFERENCES citizens(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_delivery_pev
        FOREIGN KEY (pev_id)
        REFERENCES pev(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

COMMENT ON TABLE delivery_pev IS
'Entregas de óleo realizadas pelos cidadãos nos PEVs.';


-- ============================================================================
-- TABELA: certificate_level
-- ============================================================================

CREATE TABLE certificate_level (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name VARCHAR(100)
        NOT NULL,

    description TEXT,

    required_liters DECIMAL(8,2)
        NOT NULL,

    badge_image_url VARCHAR(500),

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE certificate_level IS
'Níveis de certificação concedidos aos estabelecimentos.';


-- ============================================================================
-- TABELA: certificate
-- ============================================================================

CREATE TABLE certificate (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    certificate_code VARCHAR(64)
        NOT NULL
        UNIQUE,

    pdf_url VARCHAR(500),

    issued_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    certificate_level_id UUID
        NOT NULL,

    establishment_id UUID
        NOT NULL,

    CONSTRAINT fk_certificate_level
        FOREIGN KEY (certificate_level_id)
        REFERENCES certificate_level(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,

    CONSTRAINT fk_certificate_establishment
        FOREIGN KEY (establishment_id)
        REFERENCES establishment(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

COMMENT ON TABLE certificate IS
'Certificados emitidos aos estabelecimentos conforme os níveis atingidos.';

/*
===============================================================================
PROJETO.............: ÓLEO AMIGO
BANCO DE DADOS......: PostgreSQL
SCRIPT..............: 01 - Estrutura do Banco de Dados
PARTE...............: 3/3

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script contém:

• users_log
• citizens_log
• establishment_log
• driver_log
• pev_log
• collection_request_log
• collection_log
• delivery_pev_log
• certificate_log


Todas as tabelas de auditoria armazenam uma cópia do registro original
no momento da operação, permitindo rastreabilidade completa.

===============================================================================
*/

-- ============================================================================
-- TABELA: users_log
-- ============================================================================

CREATE TABLE users_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    name VARCHAR(150)
        NOT NULL,

    email VARCHAR(255)
        NOT NULL,

    password_hash VARCHAR(255)
        NOT NULL,

    user_type user_type_t
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        NOT NULL,

    CONSTRAINT fk_users_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE users_log IS
'Auditoria das operações realizadas sobre a tabela users.';


-- ============================================================================
-- TABELA: citizens_log
-- ============================================================================

CREATE TABLE citizens_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    cpf CHAR(11)
        NOT NULL,

    qr_token VARCHAR(64)
        NOT NULL,

    points INTEGER
        NOT NULL,

    CONSTRAINT fk_citizens_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE citizens_log IS
'Auditoria das operações realizadas sobre a tabela citizens.';


-- ============================================================================
-- TABELA: establishment_log
-- ============================================================================

CREATE TABLE establishment_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    cnpj CHAR(14)
        NOT NULL,

    description TEXT,

    is_pev BOOLEAN
        NOT NULL,

    qr_token VARCHAR(64)
        NOT NULL,

    type_id UUID
        NOT NULL,

    address_id UUID
        NOT NULL,

    points INTEGER
        NOT NULL,

    CONSTRAINT fk_establishment_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE establishment_log IS
'Auditoria das operações realizadas sobre a tabela establishment.';


-- ============================================================================
-- TABELA: driver_log
-- ============================================================================

CREATE TABLE driver_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    name VARCHAR(150)
        NOT NULL,

    cpf CHAR(11)
        NOT NULL,

    cnh CHAR(11)
        NOT NULL,

    registration_date TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        NOT NULL,

    status active_status_t
        NOT NULL,

    CONSTRAINT fk_driver_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE driver_log IS
'Auditoria das operações realizadas sobre a tabela driver.';

-- ============================================================================
-- TABELA: pev_log
-- ============================================================================

CREATE TABLE pev_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    status approval_status_t
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL,

    approved_at TIMESTAMP,

    approved_by UUID,

    citizen_id UUID,

    establishment_id UUID,

    address_id UUID
        NOT NULL,

    CONSTRAINT fk_pev_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE pev_log IS
'Auditoria das operações realizadas sobre a tabela pev.';


-- ============================================================================
-- TABELA: collection_request_log
-- ============================================================================

CREATE TABLE collection_request_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    estimated_volume_liters DECIMAL(8,2)
        NOT NULL,

    status request_status_t
        NOT NULL,

    observation TEXT,

    request_at TIMESTAMP
        NOT NULL,

    updated_at TIMESTAMP
        NOT NULL,

    establishment_id UUID
        NOT NULL,

    approved_by UUID,

    CONSTRAINT fk_collection_request_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE collection_request_log IS
'Auditoria das operações realizadas sobre a tabela collection_request.';


-- ============================================================================
-- TABELA: collection_log
-- ============================================================================

CREATE TABLE collection_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    collected_volume_liters DECIMAL(8,2)
        NOT NULL,

    points_earned INTEGER,

    observation TEXT,

    collection_date TIMESTAMP
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL,

    collection_request_id UUID,

    driver_id UUID
        NOT NULL,

    CONSTRAINT fk_collection_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE collection_log IS
'Auditoria das operações realizadas sobre a tabela collection.';


-- ============================================================================
-- TABELA: delivery_pev_log
-- ============================================================================

CREATE TABLE delivery_pev_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    oil_volume_liters DECIMAL(8,2)
        NOT NULL,

    points_earned INTEGER
        NOT NULL,

    delivery_date TIMESTAMP
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL,

    citizen_id UUID
        NOT NULL,

    pev_id UUID
        NOT NULL,

    CONSTRAINT fk_delivery_pev_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE delivery_pev_log IS
'Auditoria das operações realizadas sobre a tabela delivery_pev.';


-- ============================================================================
-- TABELA: certificate_log
-- ============================================================================

CREATE TABLE certificate_log (

    log_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    operation operation_status_t
        NOT NULL,

    performed_at TIMESTAMP
        NOT NULL,

    performed_by UUID,

    id UUID
        NOT NULL,

    certificate_code VARCHAR(64)
        NOT NULL,

    pdf_url VARCHAR(500),

    issued_at TIMESTAMP
        NOT NULL,

    created_at TIMESTAMP
        NOT NULL,

    certificate_level_id UUID
        NOT NULL,

    establishment_id UUID
        NOT NULL,

    CONSTRAINT fk_certificate_log_user
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

COMMENT ON TABLE certificate_log IS
'Auditoria das operações realizadas sobre a tabela certificate.';