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

CREATE PROCEDURE public.schedule_collection_request_once(
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

COMMIT;
