\set ON_ERROR_STOP on
BEGIN;
\ir fixtures_procedures.sql
GRANT USAGE ON SCHEMA olius_test TO olius_api;
GRANT SELECT ON olius_test.ids TO olius_api;

SET LOCAL SESSION AUTHORIZATION olius_api;
DO $test$
DECLARE
    request_id UUID;
    first_key UUID := gen_random_uuid();
    second_key UUID := gen_random_uuid();
    noop_key UUID := gen_random_uuid();
    first_time TIMESTAMPTZ := CURRENT_TIMESTAMP + INTERVAL '1 day';
    agreed TIMESTAMPTZ := CURRENT_TIMESTAMP;
    admin UUID := olius_test.id('admin');
    n BIGINT;
BEGIN
    CALL public.create_collection_request(olius_test.id('est'),10,'Idempotência',gen_random_uuid(),request_id);
    CALL public.schedule_collection_request_once(request_id,first_time,agreed,admin,' Primeiro acordo ',first_key);
    CALL public.schedule_collection_request_once(request_id,first_time+INTERVAL '1 day',agreed,admin,'Segundo acordo',second_key);
    -- Reenvio atrasado deve reconhecer a ação original, preservando a agenda posterior.
    CALL public.schedule_collection_request_once(request_id,first_time,agreed,admin,'Primeiro acordo',first_key);
    PERFORM olius_test.assert((SELECT scheduled_at=first_time+INTERVAL '1 day'
        FROM public.collection_request WHERE id=request_id),'reenvio antigo preserva reagendamento posterior');
    PERFORM olius_test.assert((SELECT count(*)=2 FROM public.collection_schedule_history WHERE collection_request_id=request_id),
        'reenvio não acrescenta histórico');
    PERFORM olius_test.assert((SELECT count(*)=2 FROM public.notification WHERE resource_id=request_id),
        'reenvio não acrescenta aviso');

    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
        request_id,first_time+INTERVAL '1 hour',agreed,admin,'Primeiro acordo',first_key),'22000');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
        request_id,first_time,agreed-INTERVAL '1 second',admin,'Primeiro acordo',first_key),'22000');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
        request_id,first_time,agreed,admin,'Outro motivo',first_key),'22000');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,NULL)',
        request_id,first_time,agreed,admin,'Sem chave'),'22023');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
        request_id,first_time,agreed,olius_test.id('citizen'),'Sem autorização',gen_random_uuid()),'42501');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
        gen_random_uuid(),first_time,agreed,admin,'Pedido inexistente',gen_random_uuid()),'P0002');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
        request_id,CURRENT_TIMESTAMP-INTERVAL '1 day',agreed,admin,'Horário anterior',gen_random_uuid()),'22023');
    PERFORM olius_test.expect_error(format('CALL public.schedule_collection_request_once(%L,NULL,%L,%L,%L,%L)',
        request_id,agreed,admin,'Horário ausente',gen_random_uuid()),'22023');

    -- Mesmo sem mudar o horário, a ação precisa guardar a chave.
    CALL public.schedule_collection_request_once(request_id,first_time+INTERVAL '1 day',agreed,admin,'Mesmo horário',noop_key);
    CALL public.schedule_collection_request_once(request_id,first_time+INTERVAL '2 days',agreed,admin,'Terceiro acordo',gen_random_uuid());
    CALL public.schedule_collection_request_once(request_id,first_time+INTERVAL '1 day',agreed,admin,'Mesmo horário',noop_key);
    PERFORM olius_test.assert((SELECT scheduled_at=first_time+INTERVAL '2 days'
        FROM public.collection_request WHERE id=request_id),'chave de no-op também protege contra reenvio atrasado');

    SELECT count(*) INTO n FROM public.notification WHERE resource_id=request_id;
    BEGIN
        CALL public.schedule_collection_request_once(request_id,first_time+INTERVAL '3 days',agreed,admin,'Será revertido',gen_random_uuid());
        RAISE EXCEPTION 'Rollback controlado' USING ERRCODE='ZX001';
    EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
    END;
    PERFORM olius_test.assert((SELECT scheduled_at=first_time+INTERVAL '2 days'
        FROM public.collection_request WHERE id=request_id),'rollback preserva agenda');
    PERFORM olius_test.assert((SELECT count(*)=n FROM public.notification WHERE resource_id=request_id),
        'rollback remove aviso');
END $test$;
SELECT olius_test.expect_error('SELECT * FROM public.collection_schedule_command','42501');
SELECT olius_test.expect_error('INSERT INTO public.collection_schedule_command DEFAULT VALUES','42501');
SELECT olius_test.expect_error('UPDATE public.collection_schedule_command SET reason=reason','42501');
SELECT olius_test.expect_error('DELETE FROM public.collection_schedule_command','42501');
RESET SESSION AUTHORIZATION;

SELECT olius_test.assert((SELECT count(*)=4 FROM public.collection_schedule_command),'quatro ações confirmadas, incluindo no-op');
SELECT olius_test.assert(NOT EXISTS(SELECT 1 FROM public.collection_schedule_command WHERE reason='Será revertido'),
    'rollback remove chave');
SELECT olius_test.assert(NOT has_function_privilege('olius_reader',
    'public.schedule_collection_request_once(uuid,timestamptz,timestamptz,uuid,text,uuid)','EXECUTE'),
    'leitor sem execução');

-- Uma violação de unicidade diferente não deve ser reclassificada como retry.
CREATE FUNCTION olius_test.other_schedule_unique() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.reason='Unrelated uniqueness' THEN
        RAISE EXCEPTION 'Fixture unrelated unique' USING ERRCODE='23505',CONSTRAINT='fixture_other_unique';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER fixture_schedule_unique BEFORE INSERT ON public.collection_schedule_command
    FOR EACH ROW EXECUTE FUNCTION olius_test.other_schedule_unique();
SET LOCAL SESSION AUTHORIZATION olius_api;
SELECT olius_test.expect_error(format(
    'CALL public.schedule_collection_request_once(%L,%L,%L,%L,%L,%L)',
    (SELECT id FROM public.collection_request ORDER BY request_at DESC LIMIT 1),
    CURRENT_TIMESTAMP+INTERVAL '8 days',CURRENT_TIMESTAMP,olius_test.id('admin'),
    'Unrelated uniqueness',gen_random_uuid()),'23505');
RESET SESSION AUTHORIZATION;
SELECT olius_test.assert((SELECT count(*)=4 FROM public.collection_schedule_command),
    'falha não relacionada não deixa comando parcial');

ROLLBACK;
\echo 'PASS: late retries, conflicts, no-op keys, rollback and API permissions'
