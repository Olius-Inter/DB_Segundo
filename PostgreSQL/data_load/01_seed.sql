\set ON_ERROR_STOP on
BEGIN;
\ir 00_helpers.sql
SELECT pg_temp.dl_actor('SYSTEM');

-- Catálogos vêm de initial_data. Esta massa exige exatamente a configuração aprovada.
SELECT pg_temp.dl_assert((SELECT count(*)=3 FROM subscription_plan)
    AND (SELECT count(*)=3 FROM certificate_level)
    AND (SELECT count(*)=7 FROM establishment_type)
    AND (SELECT count(*)=3 FROM collection_failure_reason), 'catálogos exclusivos da configuração oficial');
SELECT pg_temp.dl_assert(NOT EXISTS (
    SELECT 1 FROM subscription_plan lower_plan JOIN subscription_plan higher_plan
        ON lower_plan.monthly_price < higher_plan.monthly_price
    WHERE lower_plan.volume_limit_liters >= higher_plan.volume_limit_liters
       OR lower_plan.collection_limit >= higher_plan.collection_limit), 'upgrades exigem aumento de ambos os limites');
SELECT pg_temp.dl_assert((SELECT collection_limit>=8 AND volume_limit_liters>=250
    FROM subscription_plan ORDER BY monthly_price DESC LIMIT 1), 'capacidade para a distribuição da demonstração');

INSERT INTO users(id,name,email,password_hash,user_type)
SELECT pg_temp.dl_id(kind,i),
       CASE kind WHEN 'admin' THEN '[DEMO] Administrador ' || i
            WHEN 'est' THEN '[DEMO] Estabelecimento ' || lpad(i::TEXT,3,'0')
            ELSE '[DEMO] ' || (ARRAY['Ana','Bruno','Carla','Daniel','Elisa','Felipe','Gabriela','Henrique','Isabela','João'])[1+((i-1)%10)]
                 || ' ' || (ARRAY['Almeida','Barbosa','Costa','Dias','Ferreira','Gomes','Lima','Moreira'])[1+((i-1)/10)] END,
       kind || '.' || i || '@olius.example.invalid',
       '!DEMO_ACCOUNT_NO_LOGIN!', profile::user_type_t
FROM (VALUES ('admin','ADMIN',2),('citizen','CITIZENS',80),('est','ESTABLISHMENT',30)) x(kind,profile,quantity)
CROSS JOIN LATERAL generate_series(1,quantity) n(i);
-- Estas contas não servem para autenticação: nenhum hash de senha utilizável é distribuído.
INSERT INTO user_qr_code(user_id,qr_token,user_type)
SELECT id, md5(id::TEXT || ':demonstration-qr'), user_type FROM users WHERE user_type<>'ADMIN';
INSERT INTO citizens(id,cpf,qr_token)
SELECT pg_temp.dl_id('citizen',i),pg_temp.dl_document(i),md5(pg_temp.dl_id('citizen',i)::TEXT || ':demonstration-qr')
FROM generate_series(1,80) n(i);

INSERT INTO addresses(id,owner_kind,state,city,neighborhood,street,number,cep,latitude,longitude)
SELECT pg_temp.dl_id(kind,i),owner::address_owner_t,'SP','São Paulo',
       'Bairro demonstração ' || (1+(i%5)), 'Rua fictícia ' || i,(100+i)::TEXT,'01001000',
       -23.550000-(i%15)*0.001, -46.630000-(i%12)*0.001
FROM (VALUES ('est_address','ESTABLISHMENT',30),('pev_address','PEV',8)) x(kind,owner,quantity)
CROSS JOIN LATERAL generate_series(1,quantity) n(i);
INSERT INTO establishment(id,cnpj,qr_token,type_id,address_id,description)
SELECT pg_temp.dl_id('est',i),pg_temp.dl_document(i,TRUE),md5(pg_temp.dl_id('est',i)::TEXT || ':demonstration-qr'),
       pg_temp.dl_id('type',1+(i%7)),pg_temp.dl_id('est_address',i),'Estabelecimento artificial para testes de volume.'
FROM generate_series(1,30) n(i);
INSERT INTO telephone(telephone,user_id)
SELECT '119' || lpad(n::TEXT,8,'0'),id FROM (
    SELECT id,row_number() OVER(ORDER BY id) AS n FROM users WHERE user_type<>'ADMIN'
) x;
INSERT INTO driver(id,name,cpf,cnh)
SELECT pg_temp.dl_id('driver',i),'[DEMO] Motorista ' || i,pg_temp.dl_document(100+i),
       lpad((910000000+i)::TEXT,11,'0') FROM generate_series(1,5) n(i);

SELECT pg_temp.dl_actor('USER',pg_temp.dl_id('admin',1));
INSERT INTO pev(id,citizen_id,establishment_id,address_id,status,approved_by,approved_at)
SELECT pg_temp.dl_id('pev',i),CASE WHEN i<=4 THEN pg_temp.dl_id('citizen',i) END,
       CASE WHEN i>4 THEN pg_temp.dl_id('est',i-4) END,pg_temp.dl_id('pev_address',i),
       'APPROVED',pg_temp.dl_id('admin',1),clock_timestamp()
FROM generate_series(1,8) n(i);
COMMIT;
