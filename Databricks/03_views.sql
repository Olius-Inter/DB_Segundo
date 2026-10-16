/*
===============================================================================
PROJETO.............: ÓLEO AMIGO — OLIUS
AMBIENTE............: DATABRICKS SQL — NÃO EXECUTAR NO POSTGRESQL
SCRIPT..............: 03 - Views do Star Schema e dos Dashboards
===============================================================================
Executar após 01_structure.sql. Parâmetro SQL :catalog.
As views comuns leem somente o lote publicado; não exigem REFRESH.
Criação/recriação é necessária apenas quando sua definição mudar.
*/
USE CATALOG IDENTIFIER(:catalog);

CREATE OR REPLACE VIEW olius_bi.dim_tempo AS
SELECT d.data_id, d.ano, d.trimestre, d.mes, d.dia, d.dia_semana
FROM olius_bi_landing.dim_tempo d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_estabelecimento AS
SELECT d.estabelecimento_id, d.nome, d.tipo_estabelecimento, d.estado, d.cidade, d.bairro, d.latitude, d.longitude, d.is_pev, d.status
FROM olius_bi_landing.dim_estabelecimento d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_cidadao AS
SELECT d.cidadao_id, d.nome, d.status
FROM olius_bi_landing.dim_cidadao d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_motorista AS
SELECT d.motorista_id, d.nome, d.status
FROM olius_bi_landing.dim_motorista d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_pev AS
SELECT d.pev_id, d.status, d.estado, d.cidade, d.bairro, d.latitude, d.longitude
FROM olius_bi_landing.dim_pev d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_classificacao_coleta AS
SELECT d.classificacao_id, d.resultado, d.condicao_oleo, d.ocorrencia_comprometedora
FROM olius_bi_landing.dim_classificacao_coleta d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_status_solicitacao AS
SELECT d.status_id
FROM olius_bi_landing.dim_status_solicitacao d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.dim_motivo_falha AS
SELECT d.motivo_id, d.codigo, d.nome, d.descricao
FROM olius_bi_landing.dim_motivo_falha d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.fato_coleta AS
SELECT d.coleta_id, d.data_id, d.estabelecimento_id, d.motorista_id, d.classificacao_id, d.solicitacao_id, d.volume_coletado_litros, d.volume_apresentado_litros, d.volume_estimado_litros, d.pontos_nominais, d.calculo_vigente_disponivel, d.quantidade_coletas
FROM olius_bi_landing.fato_coleta d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.fato_entrega_pev AS
SELECT d.entrega_id, d.data_id, d.cidadao_id, d.pev_id, d.volume_entregue_litros, d.pontos_nominais, d.calculo_vigente_disponivel, d.quantidade_entregas
FROM olius_bi_landing.fato_entrega_pev d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.fato_solicitacao AS
SELECT d.solicitacao_id, d.data_id, d.estabelecimento_id, d.status_id, d.solicitada_em, d.agendada_em, d.chegada_em, d.coletada_em, d.cancelada_em, d.volume_estimado_litros, d.volume_franquia_perdida_litros, d.vagas_perdidas, d.quantidade_solicitacoes, d.quantidade_reagendamentos, d.tempo_ate_coleta_horas, d.desvio_chegada_minutos, d.iniciativa_cancelamento, d.politica_cancelamento
FROM olius_bi_landing.fato_solicitacao d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.ponte_coleta_motivo AS
SELECT d.coleta_id, d.motivo_id
FROM olius_bi_landing.ponte_coleta_motivo d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

-- Uma linha por coleta: junções N:1; nenhuma junção com a ponte N:N.
CREATE OR REPLACE VIEW olius_bi.vw_coletas_dashboard AS
SELECT f.coleta_id, f.solicitacao_id, f.data_id AS data_coleta,
       t.ano, t.trimestre, t.mes,
       e.estabelecimento_id, e.nome AS estabelecimento, e.tipo_estabelecimento,
       e.estado, e.cidade, e.bairro, e.latitude, e.longitude,
       m.motorista_id, m.nome AS motorista,
       cl.resultado, cl.condicao_oleo, cl.ocorrencia_comprometedora,
       f.volume_coletado_litros, f.volume_apresentado_litros, f.volume_estimado_litros,
       f.volume_coletado_litros - f.volume_estimado_litros AS desvio_volume_litros,
       CASE WHEN f.volume_estimado_litros > 0 THEN
           (f.volume_coletado_litros - f.volume_estimado_litros) / f.volume_estimado_litros * 100
       END AS desvio_volume_percentual,
       f.pontos_nominais, f.calculo_vigente_disponivel, f.quantidade_coletas,
       CASE WHEN cl.resultado = 'SUCCESSFUL' THEN 1 ELSE 0 END AS quantidade_sucessos
FROM olius_bi.fato_coleta f
JOIN olius_bi.dim_tempo t ON t.data_id = f.data_id
JOIN olius_bi.dim_estabelecimento e ON e.estabelecimento_id = f.estabelecimento_id
JOIN olius_bi.dim_motorista m ON m.motorista_id = f.motorista_id
JOIN olius_bi.dim_classificacao_coleta cl ON cl.classificacao_id = f.classificacao_id;

CREATE OR REPLACE VIEW olius_bi.vw_entregas_dashboard AS
SELECT f.entrega_id, f.data_id AS data_entrega, t.ano, t.trimestre, t.mes,
       c.cidadao_id, c.nome AS cidadao, p.pev_id,
       p.estado, p.cidade, p.bairro, p.latitude, p.longitude,
       f.volume_entregue_litros, f.pontos_nominais,
       f.calculo_vigente_disponivel, f.quantidade_entregas
FROM olius_bi.fato_entrega_pev f
JOIN olius_bi.dim_tempo t ON t.data_id = f.data_id
JOIN olius_bi.dim_cidadao c ON c.cidadao_id = f.cidadao_id
JOIN olius_bi.dim_pev p ON p.pev_id = f.pev_id;

CREATE OR REPLACE VIEW olius_bi.vw_solicitacoes_dashboard AS
SELECT f.solicitacao_id, f.data_id AS data_solicitacao, t.ano, t.trimestre, t.mes,
       e.estabelecimento_id, e.nome AS estabelecimento, e.tipo_estabelecimento,
       e.estado, e.cidade, e.bairro,
       s.status_id AS status_solicitacao,
       f.solicitada_em, f.agendada_em, f.chegada_em, f.coletada_em, f.cancelada_em,
       f.volume_estimado_litros, f.volume_franquia_perdida_litros, f.vagas_perdidas,
       f.quantidade_solicitacoes, f.quantidade_reagendamentos,
       f.tempo_ate_coleta_horas, f.desvio_chegada_minutos,
       f.iniciativa_cancelamento, f.politica_cancelamento,
       CASE WHEN f.desvio_chegada_minutos > 0 THEN 1 ELSE 0 END AS chegada_atrasada,
       f.chegada_em IS NOT NULL AND f.agendada_em IS NOT NULL AS chegada_comparavel,
       CASE WHEN s.status_id = 'CANCELLED' THEN 1 ELSE 0 END AS quantidade_cancelamentos
FROM olius_bi.fato_solicitacao f
JOIN olius_bi.dim_tempo t ON t.data_id = f.data_id
JOIN olius_bi.dim_estabelecimento e ON e.estabelecimento_id = f.estabelecimento_id
JOIN olius_bi.dim_status_solicitacao s ON s.status_id = f.status_id;

-- Uma linha por coleta/motivo. Publica incidência, sem volumes nem pontos,
-- evitando somar a mesma coleta várias vezes em um gráfico de motivos.
CREATE OR REPLACE VIEW olius_bi.vw_falhas_dashboard AS
SELECT p.coleta_id, p.motivo_id, m.codigo AS codigo_motivo, m.nome AS motivo,
       c.data_coleta, c.ano, c.mes, c.estabelecimento_id, c.tipo_estabelecimento,
       c.estado, c.cidade, c.motorista_id, c.motorista
FROM olius_bi.ponte_coleta_motivo p
JOIN olius_bi.dim_motivo_falha m ON m.motivo_id = p.motivo_id
JOIN olius_bi.vw_coletas_dashboard c ON c.coleta_id = p.coleta_id;

-- Detalhe unificado só para volume/contagem; não inclui ranking nem certificados.
-- Nomes diferentes das quantidades B2B/B2C tornam-se quantidade_operacoes.
CREATE OR REPLACE VIEW olius_bi.vw_volume_operacoes_dashboard AS
SELECT 'B2B' AS perfil, coleta_id AS operacao_id, data_coleta AS data_operacao,
       ano, trimestre, mes, estabelecimento_id AS participante_id,
       estado, cidade, bairro, latitude, longitude,
       volume_coletado_litros AS volume_litros, quantidade_coletas AS quantidade_operacoes
FROM olius_bi.vw_coletas_dashboard
UNION ALL
SELECT 'B2C', entrega_id, data_entrega, ano, trimestre, mes, cidadao_id,
       estado, cidade, bairro, latitude, longitude,
       volume_entregue_litros, quantidade_entregas
FROM olius_bi.vw_entregas_dashboard;

CREATE OR REPLACE VIEW olius_bi.vw_atualizacao_dashboard AS
SELECT lote_id, origem_atualizada_em, publicado_em, contagens_json
FROM olius_bi_landing.publicacao WHERE mart = 'operacoes';

CREATE OR REPLACE VIEW olius_bi.ranking_anual AS
SELECT d.perfil, d.ano, d.participante_id, d.pontos_anuais, d.posicao
FROM olius_bi_landing.ranking_anual d
JOIN olius_bi_landing.publicacao p ON p.mart = 'operacoes' AND d._lote_id = p.lote_id;

CREATE OR REPLACE VIEW olius_bi.vw_ranking_dashboard AS
SELECT r.perfil, r.ano, r.participante_id,
       CASE WHEN r.perfil = 'B2B' THEN e.nome ELSE c.nome END AS participante,
       e.tipo_estabelecimento, e.estado, e.cidade,
       r.pontos_anuais, r.posicao
FROM olius_bi.ranking_anual r
LEFT JOIN olius_bi.dim_estabelecimento e
    ON r.perfil = 'B2B' AND e.estabelecimento_id = r.participante_id
LEFT JOIN olius_bi.dim_cidadao c
    ON r.perfil = 'B2C' AND c.cidadao_id = r.participante_id;
-- Ordenar na consulta do dataset: ORDER BY perfil, ano, posicao, participante_id.

