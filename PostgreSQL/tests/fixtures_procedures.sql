-- SOMENTE banco descartável. Dados artificiais; não é o script de população.
CREATE SCHEMA olius_test;
CREATE TABLE olius_test.ids (name TEXT PRIMARY KEY, id UUID NOT NULL DEFAULT gen_random_uuid());
INSERT INTO olius_test.ids(name) VALUES
('admin'), ('citizen'), ('validator'), ('est'), ('billing_est'), ('address_est'),
('address_billing'), ('address_pev'), ('type'), ('pev'), ('plan'), ('upgrade_plan'),
('subscription'), ('billing_subscription'), ('cycle'), ('driver');
CREATE FUNCTION olius_test.id(TEXT) RETURNS UUID LANGUAGE sql STABLE AS
$$ SELECT id FROM olius_test.ids WHERE name = $1 $$;
CREATE FUNCTION olius_test.assert(BOOLEAN, TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF $1 IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'TESTE FALHOU: %', $2; END IF;
END $$;
CREATE FUNCTION olius_test.expect_error(TEXT, TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE $1;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = $2 THEN RETURN; END IF;
        RAISE EXCEPTION 'SQLSTATE esperado %, recebido %: %', $2, SQLSTATE, SQLERRM;
    END;
    RAISE EXCEPTION 'Esperava erro %, mas a operação terminou com sucesso: %', $2, $1;
END $$;

INSERT INTO users(id, name, email, password_hash, user_type)
SELECT id, name, name || '@olius.test', 'hash-apenas-teste',
       CASE WHEN name = 'admin' THEN 'ADMIN'::user_type_t
            WHEN name IN ('est','billing_est') THEN 'ESTABLISHMENT'::user_type_t
            ELSE 'CITIZENS'::user_type_t END
FROM olius_test.ids WHERE name IN ('admin','citizen','validator','est','billing_est');
INSERT INTO user_qr_code(user_id, qr_token, user_type)
SELECT id, name || '-qr', user_type FROM users WHERE user_type <> 'ADMIN';
INSERT INTO citizens(id, cpf, qr_token) VALUES
(olius_test.id('citizen'), '11111111111', 'citizen-qr'),
(olius_test.id('validator'), '22222222222', 'validator-qr');
INSERT INTO addresses(id, owner_kind, state, city, neighborhood, street, number, cep)
SELECT id, CASE WHEN name = 'address_pev' THEN 'PEV'::address_owner_t ELSE 'ESTABLISHMENT'::address_owner_t END,
       'SP', 'Cidade teste', 'Centro', 'Rua teste', '1', '12345678'
FROM olius_test.ids WHERE name LIKE 'address_%';
INSERT INTO establishment_type(id, name) VALUES (olius_test.id('type'), 'Tipo teste');
INSERT INTO establishment(id, cnpj, qr_token, type_id, address_id) VALUES
(olius_test.id('est'), '11111111111111', 'est-qr', olius_test.id('type'), olius_test.id('address_est')),
(olius_test.id('billing_est'), '22222222222222', 'billing_est-qr', olius_test.id('type'), olius_test.id('address_billing'));
INSERT INTO driver(id, name, cpf, cnh) VALUES (olius_test.id('driver'), 'Motorista teste', '33333333333', '44444444444');
INSERT INTO pev(id, citizen_id, address_id, status, approved_by, approved_at)
VALUES (olius_test.id('pev'), olius_test.id('validator'), olius_test.id('address_pev'), 'APPROVED', olius_test.id('admin'), clock_timestamp());
INSERT INTO subscription_plan(id, name, monthly_price, volume_limit_liters, collection_limit) VALUES
(olius_test.id('plan'), 'Plano teste', 100, 10000, 1000),
(olius_test.id('upgrade_plan'), 'Upgrade teste', 200, 20000, 2000);
INSERT INTO establishment_subscription(id, establishment_id, status, activated_at) VALUES
(olius_test.id('subscription'), olius_test.id('est'), 'ACTIVE', clock_timestamp()),
(olius_test.id('billing_subscription'), olius_test.id('billing_est'), 'PENDING', NULL);
INSERT INTO subscription_cycle(id, subscription_id, establishment_id, cycle_number, starts_at, ends_at,
anchor_day, anchor_local_time, anchor_timezone, plan_id, plan_name, monthly_price, volume_limit_liters, collection_limit)
VALUES (olius_test.id('cycle'), olius_test.id('subscription'), olius_test.id('est'), 1,
CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '15 days',
15, '12:00', 'America/Sao_Paulo', olius_test.id('plan'), 'Plano teste', 100, 10000, 1000);
INSERT INTO collection_failure_reason(code, name) VALUES
('VOLUME_OUT_OF_TOLERANCE', 'Volume fora da faixa'), ('OIL_UNACCEPTABLE', 'Óleo inadequado'),
('COMPROMISING_OCCURRENCE', 'Ocorrência comprometedora');
INSERT INTO certificate_level(name, required_liters) VALUES ('Nível teste', 20);

CREATE FUNCTION olius_test.request(p_volume NUMERIC DEFAULT 10, p_accept BOOLEAN DEFAULT TRUE)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO collection_request(estimated_volume_liters, establishment_id, subscription_cycle_id,
        idempotency_key, status, request_at, updated_at, approved_by, approved_at, scheduled_at,
        arrived_at, arrival_recorded_at, arrival_driver_id, service_accepted_at,
        service_acceptance_recorded_at, service_accepted_by)
    VALUES (p_volume, olius_test.id('est'), olius_test.id('cycle'), gen_random_uuid(), 'APPROVED',
        CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP,
        olius_test.id('admin'), CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '2 hours',
        CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours', olius_test.id('driver'),
        CASE WHEN p_accept THEN CURRENT_TIMESTAMP - INTERVAL '90 minutes' END,
        CASE WHEN p_accept THEN CURRENT_TIMESTAMP - INTERVAL '90 minutes' END,
        CASE WHEN p_accept THEN olius_test.id('est') END)
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

-- Cria registros financeiros verificados, como faria o backend antes da CALL.
CREATE FUNCTION olius_test.payment(p_purpose billing_purpose_t, p_cycle UUID DEFAULT NULL,
    p_status charge_status_t DEFAULT 'OPEN', p_order UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_order UUID := p_order; v_charge UUID; v_payment UUID;
BEGIN
    IF v_order IS NULL THEN
        INSERT INTO billing_order(establishment_id, subscription_id, purpose, benefit_key, target_cycle_id, previous_cycle_id)
        VALUES (olius_test.id('billing_est'), olius_test.id('billing_subscription'), p_purpose,
            gen_random_uuid()::TEXT, CASE WHEN p_purpose = 'UPGRADE' THEN p_cycle END,
            CASE WHEN p_purpose = 'RENEWAL' THEN p_cycle END) RETURNING id INTO v_order;
    END IF;
    INSERT INTO billing_charge(billing_order_id, establishment_id, purpose, target_cycle_id, provider,
        status, plan_id, plan_name, quoted_monthly_price, quoted_volume_limit_liters, quoted_collection_limit,
        from_plan_id, from_monthly_price, amount, expires_at, closed_at)
    VALUES (v_order, olius_test.id('billing_est'), p_purpose, CASE WHEN p_purpose = 'UPGRADE' THEN p_cycle END,
        'test-provider', p_status,
        CASE WHEN p_purpose = 'UPGRADE' THEN olius_test.id('upgrade_plan') ELSE olius_test.id('plan') END,
        'Plano teste', CASE WHEN p_purpose = 'UPGRADE' THEN 200 ELSE 100 END,
        CASE WHEN p_purpose = 'UPGRADE' THEN 20000 ELSE 10000 END,
        CASE WHEN p_purpose = 'UPGRADE' THEN 2000 ELSE 1000 END,
        CASE WHEN p_purpose = 'UPGRADE' THEN olius_test.id('plan') END,
        CASE WHEN p_purpose = 'UPGRADE' THEN 100 END, 100,
        CURRENT_TIMESTAMP + INTERVAL '1 day', CASE WHEN p_status IN ('CANCELLED','EXPIRED','PAID') THEN clock_timestamp() END)
    RETURNING id INTO v_charge;
    INSERT INTO payment(billing_charge_id, billing_order_id, establishment_id, provider, provider_payment_id,
        amount, paid_at, verified_at, created_at)
    VALUES (v_charge, v_order, olius_test.id('billing_est'), 'test-provider', gen_random_uuid()::TEXT,
        100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id INTO v_payment;
    RETURN v_payment;
END $$;
