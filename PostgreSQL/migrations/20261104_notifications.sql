BEGIN;

-- Execute com a conta de implantacao apos aplicar access_control.
SET LOCAL ROLE olius_owner;

-- Central de notificações para os eventos aprovados.
CREATE TABLE public.notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    event_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    read_at TIMESTAMPTZ,
    CONSTRAINT uq_notification_event UNIQUE (recipient_id, type, event_id)
);
REVOKE ALL ON public.notification FROM PUBLIC;

-- Restringe a central aos eventos de PEV e agendamento aprovados para cada recurso.
ALTER TABLE public.notification
    ADD CONSTRAINT ck_notification_type CHECK (
        (resource_type = 'PEV' AND type IN ('PEV_APPROVED', 'PEV_REJECTED', 'PEV_INACTIVATED', 'PEV_REACTIVATED'))
        OR (resource_type = 'COLLECTION_REQUEST' AND type IN ('COLLECTION_REQUEST_SCHEDULED', 'COLLECTION_REQUEST_RESCHEDULED'))
    );

CREATE INDEX idx_notification_recipient_recent
    ON public.notification (recipient_id, created_at DESC, id DESC);
CREATE INDEX idx_notification_recipient_unread
    ON public.notification (recipient_id, created_at DESC, id DESC) WHERE read_at IS NULL;

CREATE FUNCTION public.notify_pev_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $notify$
DECLARE
    v_type TEXT;
    v_title TEXT;
BEGIN
    CASE
        WHEN OLD.status = 'PENDING' AND NEW.status = 'APPROVED' THEN
            v_type := 'PEV_APPROVED'; v_title := 'PEV aprovado';
        WHEN OLD.status = 'PENDING' AND NEW.status = 'REJECTED' THEN
            v_type := 'PEV_REJECTED'; v_title := 'PEV rejeitado';
        WHEN OLD.status = 'APPROVED' AND NEW.status = 'INACTIVE' THEN
            v_type := 'PEV_INACTIVATED'; v_title := 'PEV inativado';
        WHEN OLD.status = 'INACTIVE' AND NEW.status = 'APPROVED' THEN
            v_type := 'PEV_REACTIVATED'; v_title := 'PEV reativado';
        ELSE RETURN NEW;
    END CASE;

    INSERT INTO public.notification (recipient_id, type, title, message, resource_type, resource_id, event_id)
    VALUES (COALESCE(NEW.citizen_id, NEW.establishment_id), v_type, v_title,
            'Seu ' || v_title || '.', 'PEV', NEW.id, gen_random_uuid());
    RETURN NEW;
END;
$notify$;
REVOKE ALL ON FUNCTION public.notify_pev_status_change() FROM PUBLIC;

CREATE TRIGGER trg_notify_pev_status_change
    AFTER UPDATE OF status ON public.pev
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.notify_pev_status_change();

CREATE FUNCTION public.notify_collection_schedule_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $notify$
DECLARE
    v_recipient UUID;
    v_initial BOOLEAN := NEW.previous_scheduled_at IS NULL;
BEGIN
    SELECT establishment_id INTO STRICT v_recipient
    FROM public.collection_request WHERE id = NEW.collection_request_id;

    INSERT INTO public.notification (recipient_id, type, title, message, resource_type, resource_id, event_id)
    VALUES (v_recipient,
            CASE WHEN v_initial THEN 'COLLECTION_REQUEST_SCHEDULED' ELSE 'COLLECTION_REQUEST_RESCHEDULED' END,
            CASE WHEN v_initial THEN 'Coleta agendada' ELSE 'Coleta reagendada' END,
            CASE WHEN v_initial THEN 'Sua coleta foi agendada.' ELSE 'O horário da sua coleta foi alterado.' END,
            'COLLECTION_REQUEST', NEW.collection_request_id, NEW.id)
    ON CONFLICT ON CONSTRAINT uq_notification_event DO NOTHING;
    RETURN NEW;
END;
$notify$;
REVOKE ALL ON FUNCTION public.notify_collection_schedule_change() FROM PUBLIC;

CREATE TRIGGER trg_notify_collection_schedule_change
    AFTER INSERT ON public.collection_schedule_history
    FOR EACH ROW EXECUTE FUNCTION public.notify_collection_schedule_change();

-- A Core aplica a titularidade; somente as triggers inserem avisos.
GRANT SELECT, UPDATE (read_at) ON public.notification TO olius_api;

-- Central persistente: metadados revisados dos objetos introduzidos nesta entrega.
INSERT INTO public.data_catalog_table
    (schema_name, table_name, domain_name, description, business_rules, access_policy, access_status, source_reference)
SELECT 'public', 'notification', 'Notificações',
    'Avisos persistentes para mudanças de status de PEV e agendamentos B2B.',
    'Gerados por triggers na transação de origem. Unicidade por destinatário, tipo e evento. Exclusão do usuário remove os avisos por FK; prazo de retenção pendente de decisão.',
    'olius_owner mantém o objeto. olius_api consulta e atualiza somente read_at; a Core aplica titularidade e preserva a primeira leitura. Inserção pelas triggers. Leitores, BI e ranking sem acesso.',
    'DEFINED', '01_structure.sql; 02_check_constraints.sql; 03_indexes.sql; 05_triggers.sql; access_control/01_roles.sql'
WHERE to_regclass('public.notification') IS NOT NULL
ON CONFLICT (schema_name, table_name) DO UPDATE SET
    domain_name = EXCLUDED.domain_name, description = EXCLUDED.description,
    business_rules = EXCLUDED.business_rules, access_policy = EXCLUDED.access_policy,
    access_status = EXCLUDED.access_status, source_reference = EXCLUDED.source_reference
WHERE data_catalog_table.domain_name = 'Pendente de classificação';

WITH columns(column_name, description) AS (VALUES
    ('id', 'Identificador único do aviso.'),
    ('recipient_id', 'Usuário destinatário, resolvido a partir do responsável do recurso.'),
    ('type', 'Tipo estável do evento de PEV ou agendamento B2B.'),
    ('title', 'Título do aviso exibido ao destinatário.'),
    ('message', 'Mensagem do aviso gerada pelo servidor.'),
    ('resource_type', 'Categoria do recurso relacionado, PEV ou COLLECTION_REQUEST.'),
    ('resource_id', 'Identificador lógico do recurso, com autorização revalidada pela Core.'),
    ('event_id', 'Identificador da ocorrência, compartilhado com o histórico no agendamento B2B.'),
    ('created_at', 'Instante UTC de criação do aviso na transação de origem.'),
    ('read_at', 'Instante da primeira leitura, inicialmente nulo e preservado pela Core.')
)
INSERT INTO public.data_catalog_column
    (table_catalog_id, column_name, description, documentation_status, source_reference)
SELECT d.id, s.column_name, s.description, 'DOCUMENTED', '01_structure.sql; 02_check_constraints.sql; 05_triggers.sql; access_control/01_roles.sql'
FROM columns s JOIN public.data_catalog_table d
    ON d.schema_name = 'public' AND d.table_name = 'notification'
JOIN pg_catalog.pg_attribute a ON a.attrelid = to_regclass('public.notification')
    AND a.attname = s.column_name AND a.attnum > 0 AND NOT a.attisdropped
ON CONFLICT (table_catalog_id, column_name) DO UPDATE SET
    description = EXCLUDED.description, documentation_status = EXCLUDED.documentation_status,
    source_reference = EXCLUDED.source_reference
WHERE data_catalog_column.documentation_status = 'PENDING';

COMMIT;
