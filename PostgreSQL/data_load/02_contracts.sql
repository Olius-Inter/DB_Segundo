\set ON_ERROR_STOP on
BEGIN;
\ir 00_helpers.sql
SELECT pg_temp.dl_actor('USER',pg_temp.dl_id('admin',1));

-- Simula registros que o backend prepara; nenhuma integração externa é chamada.
CREATE FUNCTION pg_temp.dl_payment(est UUID, sub UUID, plan INTEGER, purpose billing_purpose_t,
                                  target UUID DEFAULT NULL, existing_order UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE p subscription_plan%ROWTYPE; cy subscription_cycle%ROWTYPE;
        ord UUID:=existing_order; charge UUID; pay UUID; application UUID; cycle UUID; refund UUID;
        amount NUMERIC; t TIMESTAMPTZ;
BEGIN
    SELECT * INTO STRICT p FROM subscription_plan WHERE id=pg_temp.dl_id('plan',plan);
    IF target IS NOT NULL THEN SELECT * INTO STRICT cy FROM subscription_cycle WHERE id=target; END IF;
    IF ord IS NULL THEN
        INSERT INTO billing_order(establishment_id,subscription_id,purpose,benefit_key,target_cycle_id)
        VALUES(est,sub,purpose,md5(est::TEXT || ':' || purpose::TEXT),target) RETURNING id INTO ord;
    END IF;
    amount:=CASE WHEN purpose='UPGRADE' THEN p.monthly_price-cy.monthly_price ELSE p.monthly_price END;
    INSERT INTO billing_charge(billing_order_id,establishment_id,purpose,target_cycle_id,provider,
        provider_charge_id,plan_id,plan_name,plan_description,quoted_monthly_price,
        quoted_volume_limit_liters,quoted_collection_limit,from_plan_id,from_monthly_price,amount,expires_at)
    VALUES(ord,est,purpose,target,'OLIUS_SIMULATION',gen_random_uuid()::TEXT,p.id,p.name,p.description,
        p.monthly_price,p.volume_limit_liters,p.collection_limit,
        CASE WHEN purpose='UPGRADE' THEN cy.plan_id END,
        CASE WHEN purpose='UPGRADE' THEN cy.monthly_price END,amount,clock_timestamp()+INTERVAL '1 day')
    RETURNING id INTO charge;
    t:=clock_timestamp();
    INSERT INTO payment(billing_charge_id,billing_order_id,establishment_id,provider,provider_payment_id,
                        amount,paid_at,verified_at,created_at)
    VALUES(charge,ord,est,'OLIUS_SIMULATION',gen_random_uuid()::TEXT,amount,t,t,t) RETURNING id INTO pay;
    CALL apply_verified_payment(pay,application,cycle,refund);
    RETURN pay;
END $$;

DO $$
DECLARE i INTEGER; sub UUID; pay UUID; cycle UUID; application UUID; refund UUID;
        first_pay UUID; ord UUID; first_cycle UUID; end_before TIMESTAMPTZ;
BEGIN
    FOR i IN 1..30 LOOP
        INSERT INTO establishment_subscription(id,establishment_id)
        VALUES(pg_temp.dl_id('subscription',i),pg_temp.dl_id('est',i)) RETURNING id INTO sub;
        -- Dois upgrades demonstram a substituição de limites sem trocar o período.
        pay:=pg_temp.dl_payment(pg_temp.dl_id('est',i),sub,CASE WHEN i<=2 THEN i ELSE 3 END,'INITIAL');
        IF i<=2 THEN
            SELECT sc.id,sc.ends_at INTO cycle,end_before FROM subscription_cycle sc WHERE sc.subscription_id=sub;
            PERFORM pg_temp.dl_payment(pg_temp.dl_id('est',i),sub,3,'UPGRADE',cycle);
            PERFORM pg_temp.dl_assert((SELECT ends_at=end_before FROM subscription_cycle WHERE id=cycle),
                                     'upgrade não pode mudar o vencimento');
        END IF;
        IF i=1 THEN first_pay:=pay; first_cycle:=cycle; END IF;
    END LOOP;
    CALL apply_verified_payment(first_pay,application,cycle,refund);
    PERFORM pg_temp.dl_assert(cycle=first_cycle AND refund IS NULL,'reenvio do pagamento deve reutilizar benefício');
    -- Outro pagamento verificado para a mesma ordem pede reembolso integral.
    -- A cobrança original já está PAID, portanto uma nova tentativa não ocupa vaga aberta concorrente.
    SELECT billing_order_id INTO ord FROM payment WHERE id=first_pay;
    pay:=pg_temp.dl_payment(pg_temp.dl_id('est',1),pg_temp.dl_id('subscription',1),1,'INITIAL',NULL,ord);
    PERFORM pg_temp.dl_assert(EXISTS(SELECT 1 FROM payment_refund WHERE payment_id=pay AND reason='DUPLICATE_BENEFIT'),
                             'benefício duplicado deve solicitar reembolso');
END $$;
-- O commit antecede os pedidos: o ciclo começa no relógio real da aplicação do pagamento.
COMMIT;
