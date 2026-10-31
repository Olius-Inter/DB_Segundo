-- Somente banco descartável. Toda a fixture é revertida.
\set ON_ERROR_STOP on
BEGIN;
\ir fixtures_procedures.sql
CREATE FUNCTION olius_test.history_error(p_mutation TEXT,p_collection UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_mutation;
        PERFORM olius_test.expect_error(format('SELECT * FROM public.get_collection_revision_history(%L,%L)',
            p_collection,olius_test.id('admin')),'55000');
        RAISE EXCEPTION 'reverter corrupção artificial' USING ERRCODE='P9001';
    EXCEPTION WHEN SQLSTATE 'P9001' THEN NULL;
    END;
END $$;
DO $$
DECLARE req UUID; col UUID; volume_id UUID; oil_id UUID; occurrence_id UUID;
        expected UUID[]; actor UUID; n INTEGER; before_hash TEXT; after_hash TEXT; replay UUID[];
BEGIN
    SELECT id INTO volume_id FROM collection_failure_reason WHERE code='VOLUME_OUT_OF_TOLERANCE';
    SELECT id INTO oil_id FROM collection_failure_reason WHERE code='OIL_UNACCEPTABLE';
    SELECT id INTO occurrence_id FROM collection_failure_reason WHERE code='COMPROMISING_OCCURRENCE';
    req:=olius_test.request();
    PERFORM set_config('app.audit_actor','DRIVER_FORM',true);
    PERFORM set_config('app.current_user_id','',true);
    PERFORM set_config('app.operational_driver_id',olius_test.id('driver')::TEXT,true);
    CALL record_collection(req,olius_test.id('driver'),0,0,'NOT_ASSESSED',FALSE,
        ARRAY['VOLUME_OUT_OF_TOLERANCE'],'Inicial',clock_timestamp()-INTERVAL '1 hour',col);
    INSERT INTO olius_test.ids(name,id) VALUES('history_collection',col);
    PERFORM olius_test.assert((SELECT count(*)=1 AND max(revision)=1 AND max(total_elements)=1
        FROM get_collection_revision_history(col,olius_test.id('admin'))),'registro inicial');
    PERFORM set_config('app.audit_actor','USER',true);
    PERFORM set_config('app.current_user_id',olius_test.id('admin')::TEXT,true);
    PERFORM set_config('app.operational_driver_id','',true);
    PERFORM set_config('app.audit_reason','Correção verificada',true);
    CALL correct_collection(col,1,olius_test.id('admin'),'RECORDED',10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],'Revisão 2','Correção 2');
    CALL correct_collection(col,2,olius_test.id('admin'),'RECORDED',0,2,'UNACCEPTABLE',TRUE,
        ARRAY['VOLUME_OUT_OF_TOLERANCE','OIL_UNACCEPTABLE','COMPROMISING_OCCURRENCE'],'Revisão 3','Correção 3');
    CALL correct_collection(col,3,olius_test.id('admin'),'ANNULLED',NULL,NULL,NULL,NULL,NULL,NULL,'Anulação 4');
    CALL correct_collection(col,4,olius_test.id('admin'),'RECORDED',0,2,'UNACCEPTABLE',FALSE,
        ARRAY['VOLUME_OUT_OF_TOLERANCE','OIL_UNACCEPTABLE'],'Restauração 5','Restauração 5');
    CALL correct_collection(col,5,olius_test.id('admin'),'RECORDED',0,2,'UNACCEPTABLE',FALSE,
        ARRAY['VOLUME_OUT_OF_TOLERANCE','OIL_UNACCEPTABLE'],'Somente observação 6','Correção 6');
    PERFORM olius_test.assert((SELECT count(*)=6 AND count(DISTINCT revision)=6 AND max(total_elements)=6
        FROM get_collection_revision_history(col,olius_test.id('admin'))),'uma linha por revisão, sem duplicar BEFORE/AFTER');
    PERFORM olius_test.assert((SELECT array_agg(revision)=ARRAY[6,5,4,3,2,1]
        FROM get_collection_revision_history(col,olius_test.id('admin'))),'ordem decrescente determinística');
    PERFORM olius_test.assert((SELECT max(revision)<>(SELECT max(pc.revision) FROM point_calculation pc WHERE pc.collection_id=col)
        FROM get_collection_revision_history(col,olius_test.id('admin'))),'revisão operacional independente do cálculo');
    FOR n IN 1..6 LOOP
        expected:=CASE n WHEN 1 THEN ARRAY[volume_id] WHEN 3 THEN ARRAY[volume_id,oil_id,occurrence_id]
            WHEN 5 THEN ARRAY[volume_id,oil_id] WHEN 6 THEN ARRAY[volume_id,oil_id] ELSE ARRAY[]::UUID[] END;
        SELECT COALESCE(array_agg(x ORDER BY x),ARRAY[]::UUID[]) INTO expected FROM unnest(expected) x;
        PERFORM olius_test.assert((SELECT failure_reason_ids=expected FROM get_collection_revision_history(col,olius_test.id('admin')) h
            WHERE h.revision=n),'motivos originais da revisão '||n);
    END LOOP;
    PERFORM olius_test.assert((SELECT actor_kind='DRIVER_FORM' AND performed_by IS NULL
        AND operational_driver_id=olius_test.id('driver') AND driver_id=olius_test.id('driver')
        AND recorded_at>=collection_date FROM get_collection_revision_history(col,olius_test.id('admin')) WHERE revision=1),'contexto original da visita');
    PERFORM olius_test.assert((SELECT corrected_by=olius_test.id('admin') AND correction_reason='Anulação 4'
        AND record_status='ANNULLED' FROM get_collection_revision_history(col,olius_test.id('admin')) WHERE revision=4),'autoria e anulação');
    PERFORM olius_test.assert((SELECT array_agg(revision)=ARRAY[4,3] AND max(total_elements)=6
        FROM get_collection_revision_history(col,olius_test.id('admin'),1,2)),'paginação intermediária');
    PERFORM olius_test.assert((SELECT count(*)=1 AND max(total_elements)=6 AND max(page)=3 AND max(size)=2
        AND count(revision)=0 FROM get_collection_revision_history(col,olius_test.id('admin'),3,2)),'página vazia conserva total');
    PERFORM olius_test.assert((SELECT count(*)=1 AND count(revision)=0 AND max(total_elements)=6
        FROM get_collection_revision_history(col,olius_test.id('admin'),2147483647,100)),'offset sem overflow');
    PERFORM olius_test.assert((SELECT count(*)=1 FROM get_collection_revision_history(col,olius_test.id('admin'),0,1)),'tamanho mínimo');
    PERFORM olius_test.assert((SELECT count(*)=6 FROM get_collection_revision_history(col,olius_test.id('admin'),0,100)),'tamanho máximo');
    FOREACH n IN ARRAY ARRAY[-1,0,101] LOOP
        PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L,0,%s)',col,olius_test.id('admin'),n),'22023');
    END LOOP;
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L,-1,20)',col,olius_test.id('admin')),'22023');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L,NULL,20)',col,olius_test.id('admin')),'22023');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L,0,NULL)',col,olius_test.id('admin')),'22023');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(NULL,%L)',olius_test.id('admin')),'22023');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,NULL)',col),'22023');
    FOREACH actor IN ARRAY ARRAY[olius_test.id('citizen'),gen_random_uuid()] LOOP
        PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L)',col,actor),'42501');
    END LOOP;
    INSERT INTO users(name,email,password_hash,user_type) VALUES('Outro admin','history-admin@olius.test','hash-teste','ADMIN');
    UPDATE users SET status='INACTIVE' WHERE id=olius_test.id('admin');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L)',col,olius_test.id('admin')),'42501');
    UPDATE users SET status='ACTIVE' WHERE id=olius_test.id('admin');
    PERFORM olius_test.expect_error(format('SELECT * FROM get_collection_revision_history(%L,%L)',gen_random_uuid(),olius_test.id('admin')),'P0002');

    -- Códigos são rótulos atuais; a associação histórica é preservada pelo UUID.
    UPDATE collection_failure_reason SET code='VOLUME_RENAMED_FOR_TEST' WHERE id=volume_id;
    PERFORM olius_test.assert((SELECT failure_reason_ids=ARRAY[volume_id]
        AND failure_reason_codes=ARRAY['VOLUME_RENAMED_FOR_TEST']::TEXT[]
        FROM get_collection_revision_history(col,olius_test.id('admin')) WHERE revision=1),'rótulo não substitui vínculo histórico');
    UPDATE collection_failure_reason SET code='VOLUME_OUT_OF_TOLERANCE' WHERE id=volume_id;
    BEGIN
        DELETE FROM collection_failure_reason WHERE id=occurrence_id;
        PERFORM olius_test.assert((SELECT occurrence_id=ANY(failure_reason_ids)
            AND array_position(failure_reason_codes,NULL) IS NOT NULL
            FROM get_collection_revision_history(col,olius_test.id('admin')) WHERE revision=3),
            'ID histórico preservado sem rótulo de catálogo disponível');
        RAISE EXCEPTION 'reverter catálogo de teste' USING ERRCODE='P9001';
    EXCEPTION WHEN SQLSTATE 'P9001' THEN NULL;
    END;

    PERFORM olius_test.history_error(format('DELETE FROM collection_log WHERE id=%L',col),col);
    PERFORM olius_test.history_error(format('DELETE FROM collection_log WHERE id=%L AND operation=''UPDATE'' AND snapshot_kind=''BEFORE'' AND revision=1',col),col);
    PERFORM olius_test.history_error(format('UPDATE collection_log SET revision=1 WHERE id=%L AND snapshot_kind=''AFTER'' AND revision=2',col),col);
    PERFORM olius_test.history_error(format('UPDATE collection_log SET observation=''Inconsistente'' WHERE id=%L AND snapshot_kind=''BEFORE'' AND revision=1',col),col);
    PERFORM olius_test.history_error(format('UPDATE collection_log SET observation=''Inconsistente'' WHERE id=%L AND snapshot_kind=''AFTER'' AND revision=6',col),col);
    PERFORM olius_test.history_error(format('UPDATE collection_log SET performed_at=performed_at-INTERVAL ''1 day'' WHERE id=%L AND snapshot_kind=''BEFORE'' AND revision=1',col),col);
    PERFORM olius_test.history_error(format('UPDATE collection_failure_log SET performed_at=(SELECT min(performed_at) FROM collection_log WHERE id=%L) WHERE collection_id=%L AND operation=''INSERT'' AND failure_reason_id=%L',col,col,volume_id),col);
    PERFORM olius_test.history_error(format('DELETE FROM collection_failure_log WHERE collection_id=%L AND operation=''DELETE''',col),col);
    PERFORM olius_test.history_error(format('UPDATE collection_failure_log SET operation=''UPDATE'' WHERE collection_id=%L AND operation=''INSERT''',col),col);
    PERFORM olius_test.history_error(format('INSERT INTO collection_log SELECT (jsonb_populate_record(NULL::collection_log,to_jsonb(l)||jsonb_build_object(''log_id'',gen_random_uuid(),''audit_event_id'',gen_random_uuid(),''operation'',''DELETE'',''snapshot_kind'',''BEFORE''))).* FROM collection_log l WHERE l.id=%L LIMIT 1',col),col);
    PERFORM olius_test.history_error(format('INSERT INTO collection_failure_log SELECT (jsonb_populate_record(NULL::collection_failure_log,to_jsonb(l)||jsonb_build_object(''log_id'',gen_random_uuid(),''audit_event_id'',gen_random_uuid()))).* FROM collection_failure_log l WHERE l.collection_id=%L AND l.operation=''INSERT'' LIMIT 1',col),col);

    SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM collection_log l),
        (SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM collection_failure_log l),
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM collection c),
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM point_calculation c))::TEXT) INTO before_hash;
    PERFORM set_config('app.audit_actor','CONTEXTO_EXTERNO',true);
    PERFORM set_config('app.current_user_id','sem-UUID-para-provar-ausência-de-conversão',true);
    PERFORM get_collection_revision_history(col,olius_test.id('admin'));
    PERFORM olius_test.assert(current_setting('app.audit_actor')='CONTEXTO_EXTERNO'
        AND current_setting('app.current_user_id')='sem-UUID-para-provar-ausência-de-conversão','contexto intacto');
    SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM collection_log l),
        (SELECT jsonb_agg(to_jsonb(l) ORDER BY log_id) FROM collection_failure_log l),
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM collection c),
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM point_calculation c))::TEXT) INTO after_hash;
    PERFORM olius_test.assert(before_hash=after_hash,'consulta sem efeitos colaterais');
END $$;

GRANT USAGE ON SCHEMA olius_test TO olius_api;
GRANT SELECT ON olius_test.ids TO olius_api;
SELECT olius_test.id('history_collection') AS col,olius_test.id('admin') AS admin \gset
SET LOCAL SESSION AUTHORIZATION olius_core_api;
SELECT olius_test.assert((SELECT count(*)=6 FROM public.get_collection_revision_history(:'col',:'admin')),'conta limitada da Core');
SELECT olius_test.expect_error('SELECT * FROM public.collection_log','42501');
SELECT olius_test.expect_error('SELECT * FROM public.collection_failure_log','42501');
RESET SESSION AUTHORIZATION;
DO $$ DECLARE role_name TEXT; f OID:='public.get_collection_revision_history(uuid,uuid,integer,integer)'::regprocedure;
BEGIN
    PERFORM olius_test.assert((SELECT prosecdef AND provolatile='s' AND proowner='olius_business_owner'::regrole
        FROM pg_proc WHERE oid=f),'STABLE e proprietário restrito');
    PERFORM olius_test.assert(NOT EXISTS(SELECT 1 FROM pg_proc p,
        LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
        WHERE p.oid=f AND a.grantee=0 AND a.privilege_type='EXECUTE'),'PUBLIC sem EXECUTE');
    FOREACH role_name IN ARRAY ARRAY['olius_reader','olius_auditor','olius_catalog_editor','olius_owner',
        'olius_ranking_reader','olius_redis_api','olius_bi_reader','olius_bi_refresh','olius_dm_admin'] LOOP
        PERFORM olius_test.assert(NOT has_function_privilege(role_name,f,'EXECUTE'),'sem execução por '||role_name);
    END LOOP;
END $$;
ROLLBACK;
\echo 'PASS: histórico operacional, motivos, paginação, auditoria, autorização e integridade'
