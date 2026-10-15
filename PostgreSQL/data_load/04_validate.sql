\set ON_ERROR_STOP on
BEGIN;
\ir 00_helpers.sql
SELECT pg_temp.dl_assert((SELECT count(*)=112 FROM users),'112 usuários esperados');
SELECT pg_temp.dl_assert((SELECT count(*)=80 FROM citizens),'80 cidadãos esperados');
SELECT pg_temp.dl_assert((SELECT count(*)=30 FROM establishment),'30 estabelecimentos esperados');
SELECT pg_temp.dl_assert((SELECT count(*)=5 FROM driver),'cinco motoristas esperados');
SELECT pg_temp.dl_assert((SELECT count(*)=8 FROM pev),'oito PEVs esperados');
SELECT pg_temp.dl_assert((SELECT count(*)=240 FROM collection_request),'240 pedidos, sem duplicações');
SELECT pg_temp.dl_assert((SELECT count(*)=200 FROM collection),'200 visitas, sem duplicações');
SELECT pg_temp.dl_assert((SELECT count(*)=400 FROM delivery_pev),'400 entregas, sem duplicações');
SELECT pg_temp.dl_assert((SELECT count(*)=199 FROM collection WHERE record_status='RECORDED'),
                        '199 visitas vigentes após uma anulação');
SELECT pg_temp.dl_assert((SELECT count(*)=159 FROM collection WHERE record_status='RECORDED' AND result='SUCCESSFUL'),
                        '159 sucessos vigentes após uma anulação');
SELECT pg_temp.dl_assert((SELECT count(*)=40 FROM collection WHERE record_status='RECORDED' AND result='UNSUCCESSFUL'),
                        '40 malsucessos vigentes');
SELECT pg_temp.dl_assert((SELECT count(*)=399 FROM delivery_pev WHERE record_status='RECORDED'),
                        '399 entregas vigentes após uma anulação');
SELECT pg_temp.dl_assert((SELECT count(*)=10 FROM collection_request WHERE status='PENDING')
    AND (SELECT count(*)=10 FROM collection_request WHERE status='REJECTED')
    AND (SELECT count(*)=10 FROM collection_request WHERE cancellation_policy='FREE')
    AND (SELECT count(*)=10 FROM collection_request WHERE cancellation_policy='LATE_FORFEITURE'),
    'dez pedidos em cada cenário sem coleta');
SELECT pg_temp.dl_assert((SELECT count(*)=30 FROM subscription_cycle)
    AND (SELECT count(*)=32 FROM payment_application)
    AND (SELECT count(*)=2 FROM subscription_cycle_change)
    AND (SELECT count(*)=1 FROM payment_refund), 'pagamentos, ciclos, upgrades e reembolso coerentes');
SELECT pg_temp.dl_assert((SELECT count(*)=600 FROM point_calculation WHERE is_current),
                        'um cálculo vigente por operação, incluindo anuladas');
SELECT pg_temp.dl_assert(EXISTS(SELECT 1 FROM point_calculation WHERE NOT is_current),
                        'correções devem preservar cálculos anteriores');
SELECT pg_temp.dl_assert(NOT EXISTS(
    SELECT 1 FROM point_calculation pc LEFT JOIN point_transaction pt ON pt.point_calculation_id=pc.id
    GROUP BY pc.id,pc.points_total HAVING pc.points_total<>COALESCE(sum(pt.points),0)),
    'componentes nominais devem somar o total de cada revisão');
SELECT pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM establishment e
    WHERE e.is_pev IS DISTINCT FROM EXISTS(SELECT 1 FROM pev p WHERE p.establishment_id=e.id AND p.status='APPROVED')),
    'flag is_pev deve corresponder ao PEV aprovado');
SELECT pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM delivery_pev d JOIN pev p ON p.id=d.pev_id
    WHERE d.validated_by IS DISTINCT FROM COALESCE(p.citizen_id,p.establishment_id)
       OR d.validated_by=d.citizen_id),'validador é responsável e não valida a própria entrega');
SELECT pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM collection c LEFT JOIN collection_failure f ON f.collection_id=c.id
    GROUP BY c.id,c.result HAVING (c.result='UNSUCCESSFUL' AND count(f.failure_reason_id)=0)
        OR (c.result='SUCCESSFUL' AND count(f.failure_reason_id)>0)), 'motivos coerentes com o resultado');
SELECT pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM collection_request r WHERE r.status='CANCELLED'
    AND EXISTS(SELECT 1 FROM collection c WHERE c.collection_request_id=r.id)), 'cancelamento não é visita');

-- Verifica os saldos por um cálculo independente das routines, na ordem oficial.
DO $$
DECLARE u RECORD; e RECORD; pc RECORD; balance BIGINT; before_balance BIGINT;
        successes BIGINT; nominal BIGINT;
BEGIN
    FOR u IN SELECT id,points FROM establishment LOOP
        balance:=0; successes:=0;
        FOR e IN SELECT * FROM collection WHERE establishment_id=u.id ORDER BY processing_order LOOP
            IF e.record_status='ANNULLED' THEN nominal:=0;
            ELSIF e.result='UNSUCCESSFUL' THEN nominal:=-50;
            ELSE
                successes:=successes+1;
                nominal:=floor(e.collected_volume_liters)::BIGINT+50+
                    CASE WHEN successes%10=0 THEN LEAST(successes,100) ELSE 0 END;
            END IF;
            before_balance:=balance; balance:=GREATEST(0,balance+nominal);
            SELECT * INTO STRICT pc FROM point_calculation WHERE collection_id=e.id AND is_current;
            PERFORM pg_temp.dl_assert(e.points_earned=nominal AND pc.points_total=nominal
                AND pc.balance_before=before_balance AND pc.balance_after=balance,
                'pontos e piso zero B2B incoerentes na coleta ' || e.id);
        END LOOP;
        PERFORM pg_temp.dl_assert(u.points=balance,'saldo B2B incoerente para ' || u.id);
    END LOOP;
    FOR u IN SELECT id,points FROM citizens LOOP
        SELECT COALESCE(sum(CASE WHEN record_status='RECORDED' THEN floor(oil_volume_liters)::BIGINT ELSE 0 END),0)
        INTO balance FROM delivery_pev WHERE citizen_id=u.id;
        PERFORM pg_temp.dl_assert(u.points=balance,'saldo B2C incoerente para ' || u.id);
    END LOOP;
    FOR u IN SELECT * FROM subscription_cycle LOOP
        SELECT * INTO pc FROM get_cycle_availability(u.id);
        PERFORM pg_temp.dl_assert(pc.reserved_volume_liters+pc.consumed_volume_liters+pc.forfeited_volume_liters<=u.volume_limit_liters
            AND pc.reserved_collection_slots+pc.consumed_collection_slots+pc.forfeited_collection_slots<=u.collection_limit,
            'consumo/reserva/perda ultrapassou o ciclo ' || u.id);
    END LOOP;
    PERFORM pg_temp.dl_assert((SELECT count(*) FROM certificate_level)=
        (SELECT jsonb_array_length(value->'certificate_levels') FROM dl_config),
        'quantidade de metas deve corresponder à configuração');
END $$;

-- Cada fato possui snapshot INSERT; correções exigem BEFORE/AFTER e autoria.
SELECT pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM collection c WHERE NOT EXISTS(
    SELECT 1 FROM collection_log l WHERE l.id=c.id AND l.operation='INSERT' AND l.snapshot_kind='AFTER')),
    'snapshot original de cada coleta precisa existir');
SELECT pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM delivery_pev d WHERE NOT EXISTS(
    SELECT 1 FROM delivery_pev_log l WHERE l.id=d.id AND l.operation='INSERT' AND l.snapshot_kind='AFTER')),
    'snapshot original de cada entrega precisa existir');
SELECT pg_temp.dl_assert(EXISTS(SELECT 1 FROM collection_log WHERE operation='UPDATE' AND snapshot_kind='BEFORE'
    AND actor_kind='USER' AND performed_by=pg_temp.dl_id('admin',1)), 'correção B2B auditada');
SELECT pg_temp.dl_assert(EXISTS(SELECT 1 FROM collection_log WHERE actor_kind='DRIVER_FORM'
    AND operational_driver_id IS NOT NULL), 'coleta identifica o motorista operacional');

-- As views são opcionais enquanto a PR #21 não estiver integrada.
DO $$
BEGIN
    IF to_regclass('public.vw_annual_scores') IS NOT NULL THEN
        PERFORM pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_scores
            GROUP BY profile,ranking_year,participant_id HAVING count(*)>1), 'score anual duplicado');
        PERFORM pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_scores WHERE annual_points<0),
                                 'pontuação anual negativa');
    END IF;
    IF to_regclass('public.vw_annual_ranking') IS NOT NULL THEN
        PERFORM pg_temp.dl_assert(NOT EXISTS(SELECT 1 FROM public.vw_annual_ranking WHERE ranking_position<1),
                                 'posição anual inválida');
    END IF;
END $$;
COMMIT;

-- Uma linha JSON facilita guardar e comparar o relatório sem depender de logs volumosos.
SELECT jsonb_build_object(
    'users',(SELECT count(*) FROM users),'citizens',(SELECT count(*) FROM citizens),
    'establishments',(SELECT count(*) FROM establishment),'drivers',(SELECT count(*) FROM driver),
    'pevs',(SELECT count(*) FROM pev),'requests',(SELECT count(*) FROM collection_request),
    'collections',(SELECT count(*) FROM collection),'deliveries',(SELECT count(*) FROM delivery_pev),
    'valid_operations',(SELECT count(*) FROM collection WHERE record_status='RECORDED')+
                       (SELECT count(*) FROM delivery_pev WHERE record_status='RECORDED'),
    'current_calculations',(SELECT count(*) FROM point_calculation WHERE is_current),
    'historical_calculations',(SELECT count(*) FROM point_calculation WHERE NOT is_current),
    'payments',(SELECT count(*) FROM payment),'applications',(SELECT count(*) FROM payment_application),
    'upgrades',(SELECT count(*) FROM subscription_cycle_change),'refunds',(SELECT count(*) FROM payment_refund),
    'certificate_levels',(SELECT count(*) FROM certificate_level),'certificates',(SELECT count(*) FROM certificate),
    'collected_liters',(SELECT COALESCE(sum(collected_volume_liters),0) FROM collection WHERE record_status='RECORDED'),
    'delivered_liters',(SELECT COALESCE(sum(oil_volume_liters),0) FROM delivery_pev WHERE record_status='RECORDED')
);
