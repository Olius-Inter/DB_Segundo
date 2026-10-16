/*
===============================================================================
PROJETO.............: ÓLEO AMIGO — OLIUS
AMBIENTE............: DATABRICKS SQL — NÃO EXECUTAR NO POSTGRESQL
SCRIPT..............: 01 - Estrutura de Destino do Data Mart
===============================================================================
Parâmetro SQL :catalog = nome de um catálogo existente com permissão de escrita.
Executar uma vez antes do Python e das views; IF NOT EXISTS não migra schemas.
As tabelas landing guardam snapshots por lote; os dashboards usam olius_bi.
*/
USE CATALOG IDENTIFIER(:catalog);
CREATE SCHEMA IF NOT EXISTS olius_bi_landing;
CREATE SCHEMA IF NOT EXISTS olius_bi;
CREATE VOLUME IF NOT EXISTS olius_bi_landing.snapshots;

CREATE TABLE IF NOT EXISTS olius_bi_landing.publicacao (
    mart STRING,
    lote_id STRING,
    snapshot_id STRING,
    origem_atualizada_em TIMESTAMP,
    publicado_em TIMESTAMP,
    contagens_json STRING
) USING DELTA;

-- Fonte do upload para a Free Edition: /Volumes/<catalog>/olius_bi_landing/snapshots.

-- Um único registro controla a publicação de todas as fatos e dimensões.
MERGE INTO olius_bi_landing.publicacao t
USING (SELECT 'operacoes' AS mart) s ON t.mart = s.mart
WHEN NOT MATCHED THEN INSERT (mart) VALUES (s.mart);

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_tempo (
    data_id DATE,
    ano INT,
    trimestre INT,
    mes INT,
    dia INT,
    dia_semana INT,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_estabelecimento (
    estabelecimento_id STRING,
    nome STRING,
    tipo_estabelecimento STRING,
    estado STRING,
    cidade STRING,
    bairro STRING,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    is_pev BOOLEAN,
    status STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_cidadao (
    cidadao_id STRING,
    nome STRING,
    status STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_motorista (
    motorista_id STRING,
    nome STRING,
    status STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_pev (
    pev_id STRING,
    status STRING,
    estado STRING,
    cidade STRING,
    bairro STRING,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_classificacao_coleta (
    classificacao_id STRING,
    resultado STRING,
    condicao_oleo STRING,
    ocorrencia_comprometedora BOOLEAN,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_status_solicitacao (
    status_id STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.dim_motivo_falha (
    motivo_id STRING,
    codigo STRING,
    nome STRING,
    descricao STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.fato_coleta (
    coleta_id STRING,
    data_id DATE,
    estabelecimento_id STRING,
    motorista_id STRING,
    classificacao_id STRING,
    solicitacao_id STRING,
    volume_coletado_litros DECIMAL(8,2),
    volume_apresentado_litros DECIMAL(8,2),
    volume_estimado_litros DECIMAL(8,2),
    pontos_nominais BIGINT,
    calculo_vigente_disponivel BOOLEAN,
    quantidade_coletas INT,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.fato_entrega_pev (
    entrega_id STRING,
    data_id DATE,
    cidadao_id STRING,
    pev_id STRING,
    volume_entregue_litros DECIMAL(8,2),
    pontos_nominais BIGINT,
    calculo_vigente_disponivel BOOLEAN,
    quantidade_entregas INT,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.fato_solicitacao (
    solicitacao_id STRING,
    data_id DATE,
    estabelecimento_id STRING,
    status_id STRING,
    solicitada_em TIMESTAMP,
    agendada_em TIMESTAMP,
    chegada_em TIMESTAMP,
    coletada_em TIMESTAMP,
    cancelada_em TIMESTAMP,
    volume_estimado_litros DECIMAL(8,2),
    volume_franquia_perdida_litros DECIMAL(8,2),
    vagas_perdidas INT,
    quantidade_solicitacoes INT,
    quantidade_reagendamentos BIGINT,
    tempo_ate_coleta_horas DECIMAL(18,4),
    desvio_chegada_minutos DECIMAL(18,4),
    iniciativa_cancelamento STRING,
    politica_cancelamento STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.ponte_coleta_motivo (
    coleta_id STRING,
    motivo_id STRING,
    _lote_id STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS olius_bi_landing.ranking_anual (
    perfil STRING,
    ano INT,
    participante_id STRING,
    pontos_anuais DECIMAL(38,0),
    posicao BIGINT,
    _lote_id STRING
) USING DELTA;

