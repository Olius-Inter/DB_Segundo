/*
PROJETO: OLIUS | AMBIENTE: POSTGRESQL | 08 - Refresh do Data Mart
Uso manual; o Job Python também executa este procedimento antes da extração.
Não executar em paralelo com outro refresh/extração. Lock ocupado gera erro.
*/
BEGIN ISOLATION LEVEL REPEATABLE READ;
CALL dm.refresh_data_mart();
COMMIT;

SELECT snapshot_id, refreshed_at FROM dm.refresh_state WHERE singleton;
