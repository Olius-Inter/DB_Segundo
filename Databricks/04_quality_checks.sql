/*
PROJETO: OLIUS | AMBIENTE: DATABRICKS SQL | 04 - Verificações de Publicação
Executar após a primeira ingestão. Parâmetro SQL :catalog.
Complementa as verificações automáticas do Python; erro impede aprovação.
*/
USE CATALOG IDENTIFIER(:catalog);

SELECT assert_true(COUNT(*) = 1 AND COUNT(lote_id) = 1,
    'Data Mart sem lote publicado ou controle duplicado')
FROM olius_bi_landing.publicacao WHERE mart = 'operacoes';

SELECT assert_true(
    (SELECT COUNT(*) FROM olius_bi.fato_coleta) =
    (SELECT COUNT(*) FROM olius_bi.vw_coletas_dashboard),
    'Join do dashboard perdeu ou duplicou coletas');

SELECT assert_true(
    (SELECT COUNT(*) FROM olius_bi.fato_entrega_pev) =
    (SELECT COUNT(*) FROM olius_bi.vw_entregas_dashboard),
    'Join do dashboard perdeu ou duplicou entregas');

SELECT assert_true(
    (SELECT COUNT(*) FROM olius_bi.fato_solicitacao) =
    (SELECT COUNT(*) FROM olius_bi.vw_solicitacoes_dashboard),
    'Join do dashboard perdeu ou duplicou solicitações');

-- Coordenadas e cálculo podem faltar: diagnóstico, sem substituir por zero.
SELECT 'estabelecimentos_sem_coordenadas' AS indicador, COUNT(*) AS quantidade
FROM olius_bi.dim_estabelecimento WHERE latitude IS NULL OR longitude IS NULL
UNION ALL
SELECT 'pevs_sem_coordenadas', COUNT(*) FROM olius_bi.dim_pev
WHERE latitude IS NULL OR longitude IS NULL
UNION ALL
SELECT 'coletas_sem_calculo', COUNT(*) FROM olius_bi.fato_coleta
WHERE NOT calculo_vigente_disponivel
UNION ALL
SELECT 'entregas_sem_calculo', COUNT(*) FROM olius_bi.fato_entrega_pev
WHERE NOT calculo_vigente_disponivel
UNION ALL
SELECT 'tempos_ate_coleta_negativos', COUNT(*) FROM olius_bi.fato_solicitacao
WHERE tempo_ate_coleta_horas < 0;
