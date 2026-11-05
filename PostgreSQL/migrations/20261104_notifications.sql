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
    CONSTRAINT uq_notification_event UNIQUE (recipient_id, type, event_id),
    CONSTRAINT ck_notification_type CHECK (
        (resource_type = 'PEV' AND type IN ('PEV_APPROVED', 'PEV_REJECTED', 'PEV_INACTIVATED', 'PEV_REACTIVATED'))
        OR (resource_type = 'COLLECTION_REQUEST' AND type IN ('COLLECTION_REQUEST_SCHEDULED', 'COLLECTION_REQUEST_RESCHEDULED'))
    )
);
REVOKE ALL ON public.notification FROM PUBLIC;

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

COMMIT;
