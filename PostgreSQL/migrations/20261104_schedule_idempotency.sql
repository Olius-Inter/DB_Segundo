BEGIN;
SET LOCAL ROLE olius_owner;

-- Guarda a chave mesmo quando a operacao nao muda o horario nem gera historico.
CREATE TABLE public.collection_schedule_command (
    request_id UUID NOT NULL REFERENCES public.collection_request(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    agreed_at TIMESTAMPTZ NOT NULL,
    admin_id UUID NOT NULL,
    reason TEXT NOT NULL,
    PRIMARY KEY (request_id, idempotency_key)
);
REVOKE ALL ON public.collection_schedule_command FROM PUBLIC;

CREATE OR REPLACE PROCEDURE public.schedule_collection_request_once(
    p_request_id UUID, p_scheduled_at TIMESTAMPTZ, p_agreed_at TIMESTAMPTZ,
    p_admin_id UUID, p_reason TEXT, p_key UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $schedule_once$
DECLARE
    v_command public.collection_schedule_command%ROWTYPE;
    v_request_at TIMESTAMPTZ;
BEGIN
    IF p_key IS NULL THEN
        RAISE EXCEPTION 'Chave de idempotencia obrigatoria.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users
                   WHERE id = p_admin_id AND user_type = 'ADMIN' AND status = 'ACTIVE') THEN
        RAISE EXCEPTION 'Administrador indisponivel.' USING ERRCODE = '42501';
    END IF;

    -- Serializa comandos da mesma solicitacao com as operacoes legadas de agenda.
    SELECT request_at INTO v_request_at FROM public.collection_request
    WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitacao inexistente.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_command FROM public.collection_schedule_command
    WHERE request_id = p_request_id AND idempotency_key = p_key;
    IF FOUND THEN
        IF ROW(v_command.scheduled_at, v_command.agreed_at, v_command.admin_id, v_command.reason)
            IS DISTINCT FROM ROW(p_scheduled_at, p_agreed_at, p_admin_id, btrim(p_reason)) THEN
            RAISE EXCEPTION 'Chave de idempotencia ja usada com outros dados.' USING ERRCODE = '22000';
        END IF;
        RETURN;
    END IF;

    IF p_scheduled_at < v_request_at THEN
        RAISE EXCEPTION 'Horario anterior a solicitacao.' USING ERRCODE = '22023';
    END IF;

    CALL public.schedule_collection_request(
        p_request_id, p_scheduled_at, p_agreed_at, p_admin_id, p_reason);
    INSERT INTO public.collection_schedule_command
        (request_id, idempotency_key, scheduled_at, agreed_at, admin_id, reason)
    VALUES (p_request_id, p_key, p_scheduled_at, p_agreed_at, p_admin_id, btrim(p_reason));
END;
$schedule_once$;
REVOKE ALL ON PROCEDURE public.schedule_collection_request_once(UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,UUID) FROM PUBLIC;

GRANT EXECUTE ON PROCEDURE public.schedule_collection_request_once(UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,UUID) TO olius_api;

-- Comandos de agendamento identificados: documentação da proteção contra reenvios.
INSERT INTO public.data_catalog_table
    (schema_name, table_name, domain_name, description, business_rules, access_policy, access_status, source_reference)
SELECT 'public', 'collection_schedule_command', 'Coletas B2B',
    'Comandos de agendamento identificados pela solicitação e chave de idempotência.',
    'Reenvio idêntico preserva a agenda atual; dados diferentes para a mesma chave são rejeitados. Comando sem mudança também guarda a chave. Retenção das chaves pendente de decisão.',
    'olius_owner mantém o objeto. Core usa EXECUTE em schedule_collection_request_once; sem acesso direto da API, leitores, BI ou ranking.',
    'DEFINED', '01_structure.sql; 04_functions_procedures.sql; access_control/01_roles.sql'
WHERE to_regclass('public.collection_schedule_command') IS NOT NULL
ON CONFLICT (schema_name, table_name) DO UPDATE SET
    domain_name = EXCLUDED.domain_name, description = EXCLUDED.description,
    business_rules = EXCLUDED.business_rules, access_policy = EXCLUDED.access_policy,
    access_status = EXCLUDED.access_status, source_reference = EXCLUDED.source_reference
WHERE data_catalog_table.domain_name = 'Pendente de classificação';

WITH command_columns(column_name, description) AS (VALUES
    ('request_id', 'Solicitação de coleta serializada pelo comando.'),
    ('idempotency_key', 'Chave da ação, única por solicitação e preservada nos reenvios.'),
    ('scheduled_at', 'Horário proposto no comando original.'),
    ('agreed_at', 'Instante do acordo informado no comando original.'),
    ('admin_id', 'Administrador ativo que solicitou o agendamento.'),
    ('reason', 'Motivo original normalizado com remoção de espaços nas extremidades.')
)
INSERT INTO public.data_catalog_column
    (table_catalog_id, column_name, description, documentation_status, source_reference)
SELECT d.id, s.column_name, s.description, 'DOCUMENTED', '01_structure.sql; 04_functions_procedures.sql'
FROM command_columns s JOIN public.data_catalog_table d
    ON d.schema_name = 'public' AND d.table_name = 'collection_schedule_command'
JOIN pg_catalog.pg_attribute a ON a.attrelid = to_regclass('public.collection_schedule_command')
    AND a.attname = s.column_name AND a.attnum > 0 AND NOT a.attisdropped
ON CONFLICT (table_catalog_id, column_name) DO UPDATE SET
    description = EXCLUDED.description, documentation_status = EXCLUDED.documentation_status,
    source_reference = EXCLUDED.source_reference
WHERE data_catalog_column.documentation_status = 'PENDING';

COMMIT;
