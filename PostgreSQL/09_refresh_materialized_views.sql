/*
PROJETO: OLIUS | AMBIENTE: POSTGRESQL | 09 - Refresh do Data Mart
Uso manual; o Job Databricks/01_refresh.py executa a mesma procedure.
Não executar em paralelo com outro refresh. Lock ocupado gera erro.
*/
BEGIN ISOLATION LEVEL REPEATABLE READ;
CALL dm.refresh_data_mart();
COMMIT;

SELECT snapshot_id, refreshed_at FROM dm.refresh_state WHERE singleton;
