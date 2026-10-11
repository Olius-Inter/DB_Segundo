\set ON_ERROR_STOP on
BEGIN;
\ir 00_helpers.sql
SELECT pg_temp.dl_actor('SYSTEM');

INSERT INTO subscription_plan(id,name,description,monthly_price,volume_limit_liters,collection_limit)
SELECT pg_temp.dl_id('plan',ordinality::INTEGER), p->>'name',
       'Oferta oficial documentada; registro instalado para a demonstração.',
       (p->>'monthly_price')::NUMERIC, (p->>'volume_limit_liters')::NUMERIC,
       (p->>'collection_limit')::INTEGER
FROM dl_config, jsonb_array_elements(value->'plans') WITH ORDINALITY AS x(p,ordinality);
-- Metas não definidas ficam vazias; jamais inferir metas a partir dos pontos.
INSERT INTO certificate_level(id,name,required_liters)
SELECT pg_temp.dl_id('level',ordinality::INTEGER), p->>'name', (p->>'required_liters')::NUMERIC
FROM dl_config, jsonb_array_elements(value->'certificate_levels') WITH ORDINALITY AS x(p,ordinality);

INSERT INTO establishment_type(id,name,description) VALUES
(pg_temp.dl_id('type',1),'Restaurante','Categoria usada pelos estabelecimentos fictícios.'),
(pg_temp.dl_id('type',2),'Lanchonete','Categoria usada pelos estabelecimentos fictícios.'),
(pg_temp.dl_id('type',3),'Padaria','Categoria usada pelos estabelecimentos fictícios.');
INSERT INTO collection_failure_reason(code,name) VALUES
('VOLUME_OUT_OF_TOLERANCE','Volume fora da faixa'),
('OIL_UNACCEPTABLE','Óleo inadequado'),
('COMPROMISING_OCCURRENCE','Ocorrência comprometedora');

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
       pg_temp.dl_id('type',1+(i%3)),pg_temp.dl_id('est_address',i),'Estabelecimento artificial para testes de volume.'
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
