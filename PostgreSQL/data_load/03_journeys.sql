\set ON_ERROR_STOP on
BEGIN;
\ir 00_helpers.sql
CREATE TEMP TABLE dl_events(kind TEXT, number INTEGER, id UUID, request_id UUID,
                           payload JSONB, PRIMARY KEY(kind,number));
\if :use_api
-- Somente objetos temporários da carga; não amplia privilégios em tabelas reais.
GRANT SELECT ON dl_config TO olius_api;
GRANT SELECT, INSERT ON dl_events TO olius_api;
SET LOCAL ROLE olius_api;
\endif

DO $$
DECLARE i INTEGER; e UUID; d UUID; req UUID; event UUID; repeated UUID;
        estimated NUMERIC; collected NUMERIC; presented NUMERIC; condition oil_condition_t;
        occurrence BOOLEAN; codes TEXT[]; observation TEXT; dt TIMESTAMPTZ;
        citizen UUID; pev_number INTEGER; validator UUID; volume NUMERIC; token UUID;
BEGIN
    FOR i IN 1..200 LOOP
        e:=pg_temp.dl_id('est',1+((i-1)%30)); d:=pg_temp.dl_id('driver',1+((i-1)%5));
        estimated:=5+((i*7)%25); collected:=estimated; presented:=estimated;
        condition:='ACCEPTABLE'; occurrence:=FALSE; codes:=ARRAY[]::TEXT[];
        observation:='[DEMO] Visita com material separado para recolhimento.';
        IF i>160 THEN
            CASE (i-161)%4
            WHEN 0 THEN collected:=0; presented:=0; condition:='NOT_ASSESSED';
                codes:=ARRAY['VOLUME_OUT_OF_TOLERANCE']; observation:='[DEMO] Nenhum óleo apresentado na visita.';
            WHEN 1 THEN collected:=0; condition:='UNACCEPTABLE';
                codes:=ARRAY['VOLUME_OUT_OF_TOLERANCE','OIL_UNACCEPTABLE']; observation:='[DEMO] Óleo apresentado foi recusado por contaminação.';
            WHEN 2 THEN occurrence:=TRUE; codes:=ARRAY['COMPROMISING_OCCURRENCE'];
                observation:='[DEMO] Ocorrência operacional comprometeu o atendimento.';
            ELSE collected:=round(estimated*0.5,2); codes:=ARRAY['VOLUME_OUT_OF_TOLERANCE'];
                observation:='[DEMO] Somente parte do volume estimado estava disponível.';
            END CASE;
        END IF;
        PERFORM pg_temp.dl_actor('USER',e);
        CALL create_collection_request(e,estimated,observation,pg_temp.dl_id('request_key',i),req);
        CALL create_collection_request(e,estimated,observation,pg_temp.dl_id('request_key',i),repeated);
        PERFORM pg_temp.dl_assert(repeated=req,'reenvio do pedido não pode duplicar reserva');
        PERFORM pg_temp.dl_actor('USER',pg_temp.dl_id('admin',1));
        CALL schedule_collection_request(req,clock_timestamp(),clock_timestamp(),pg_temp.dl_id('admin',1),
                                        '[DEMO] Horário acordado para atendimento imediato.');
        PERFORM pg_temp.dl_actor('DRIVER_FORM',NULL,d);
        PERFORM record_collection_arrival(req,d);
        PERFORM pg_temp.dl_actor('USER',e);
        PERFORM accept_collection_service(req,e);
        PERFORM pg_temp.dl_actor('DRIVER_FORM',NULL,d);
        dt:=clock_timestamp();
        CALL record_collection(req,d,collected,presented,condition,occurrence,codes,observation,dt,event);
        CALL record_collection(req,d,collected,presented,condition,occurrence,codes,observation,dt,repeated);
        PERFORM pg_temp.dl_assert(repeated=event,'reenvio da coleta deve retornar a mesma visita');
        INSERT INTO dl_events VALUES('collection',i,event,req,jsonb_build_object('date',dt,'estimated',estimated));
    END LOOP;

    -- Cada estabelecimento teve 6 ou 7 visitas. Distribuir mais 40 pedidos
    -- completa oito solicitações originais por dono, dentro do Plano Empresa.
    FOR i IN 201..240 LOOP
        e:=pg_temp.dl_id('est',1+((i-1)%30));
        PERFORM pg_temp.dl_actor('USER',e);
        CALL create_collection_request(e,10,'[DEMO] Pedido sem coleta física.',pg_temp.dl_id('request_key',i),req);
        IF i BETWEEN 211 AND 220 THEN
            PERFORM pg_temp.dl_actor('USER',pg_temp.dl_id('admin',2));
            PERFORM reject_collection_request(req,pg_temp.dl_id('admin',2),'[DEMO] Atendimento indisponível.');
        ELSIF i>=221 THEN
            PERFORM pg_temp.dl_actor('USER',pg_temp.dl_id('admin',1));
            CALL schedule_collection_request(req,clock_timestamp()+CASE WHEN i<=230 THEN INTERVAL '6 hours' ELSE INTERVAL '1 hour' END,
                clock_timestamp(),pg_temp.dl_id('admin',1),'[DEMO] Agendamento antes do cancelamento.');
            PERFORM pg_temp.dl_actor('USER',e);
            CALL cancel_collection_request(req,e,'ESTABLISHMENT','[DEMO] Cancelamento pelo estabelecimento.');
            PERFORM pg_temp.dl_assert((SELECT cancellation_policy=CASE WHEN i<=230 THEN 'FREE'::cancellation_policy_t
                ELSE 'LATE_FORFEITURE'::cancellation_policy_t END FROM collection_request WHERE id=req),
                'política de cancelamento deve distinguir antecedência e perda tardia');
        END IF;
    END LOOP;

    FOR i IN 1..400 LOOP
        citizen:=pg_temp.dl_id('citizen',CASE WHEN i<=240 THEN 1+((i-1)%80) ELSE 1+((i-1)%20) END);
        pev_number:=1+((i-1)%8);
        validator:=CASE WHEN pev_number<=4 THEN pg_temp.dl_id('citizen',pev_number)
                        ELSE pg_temp.dl_id('est',pev_number-4) END;
        -- Um cidadão responsável nunca valida a própria entrega.
        IF citizen=validator THEN pev_number:=5; validator:=pg_temp.dl_id('est',1); END IF;
        volume:=round((0.25+(i*13%70)/4.0)::NUMERIC,2);
        token:=pg_temp.dl_id('delivery_key',i);
        -- B2C aceita lançamento posterior: distribuir até 14 dias do mês vigente,
        -- sem alterar o relógio, retroagir pedidos B2B ou criar fatos futuros.
        dt:=clock_timestamp()-make_interval(days=>((i-1)%LEAST(14,
            EXTRACT(DAY FROM clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::INTEGER)));
        PERFORM pg_temp.dl_actor('USER',validator);
        CALL record_pev_delivery(token,citizen,pg_temp.dl_id('pev',pev_number),validator,volume,dt,event);
        CALL record_pev_delivery(token,citizen,pg_temp.dl_id('pev',pev_number),validator,volume,dt,repeated);
        PERFORM pg_temp.dl_assert(repeated=event,'reenvio B2C não pode duplicar entrega');
        INSERT INTO dl_events VALUES('delivery',i,event,NULL,jsonb_build_object('date',dt,'volume',volume));
    END LOOP;
END $$;

-- Correções preservam identidade e revisões. Duas anulações deixam 598 fatos válidos.
SELECT pg_temp.dl_actor('USER',pg_temp.dl_id('admin',1));
DO $$
DECLARE c UUID; d UUID; volume NUMERIC; dt TIMESTAMPTZ;
BEGIN
    SELECT id,(payload->>'estimated')::NUMERIC INTO c,volume FROM dl_events WHERE kind='collection' AND number=10;
    CALL correct_collection(c,1,pg_temp.dl_id('admin',1),'RECORDED',round(volume*0.95,2),volume,'ACCEPTABLE',FALSE,
        ARRAY[]::TEXT[],'[DEMO] Volume conferido novamente.','[DEMO] Correção administrativa de volume.');
    SELECT id INTO c FROM dl_events WHERE kind='collection' AND number=30;
    CALL correct_collection(c,1,pg_temp.dl_id('admin',1),'ANNULLED',NULL,NULL,NULL,NULL,NULL,NULL,
                            '[DEMO] Visita lançada indevidamente.');
    SELECT id,(payload->>'volume')::NUMERIC,(payload->>'date')::TIMESTAMPTZ INTO d,volume,dt
    FROM dl_events WHERE kind='delivery' AND number=10;
    CALL correct_pev_delivery(d,1,pg_temp.dl_id('admin',1),'RECORDED',volume+1,dt,'[DEMO] Correção de medição da entrega.');
    SELECT id INTO d FROM dl_events WHERE kind='delivery' AND number=20;
    CALL correct_pev_delivery(d,1,pg_temp.dl_id('admin',1),'ANNULLED',NULL,NULL,'[DEMO] Entrega lançada indevidamente.');
END $$;
COMMIT;
