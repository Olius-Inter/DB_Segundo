# Atualização, publicação e validação

## Como uma carga acontece

1. Fora do Databricks, 06_export_snapshot.py abre a conexão de refresh no Aiven
   e adquire advisory lock de sessão.
2. Chama dm.refresh_data_mart em REPEATABLE READ: as views materializadas
   recebem uma fotografia consistente, com novo snapshot_id no mesmo commit.
3. A conta leitora abre uma transação REPEATABLE READ READ ONLY. O exportador
   mantém a conexão de controle/lock enquanto extrai todos os conjuntos.
4. Produz Parquets e confere quantidades. O manifest.json é escrito por último,
   com identificadores, horário, hashes e totais. A sessão/lock é liberada.
5. Os arquivos são enviados ao Volume; o manifesto deve ser enviado por último.
6. No Databricks, 02_ingestion.py verifica contrato, UUIDs, horário e hashes;
   lê os Parquets, grava um lote Delta e valida tipos, chaves, totais e relações.
7. Após validar todos os conjuntos, troca o ponteiro publicacao em uma única
   escrita Delta. Somente o lote publicado aparece nas views de consumo.

Novas operações depois da fotografia entram no próximo export. Correções e
anulações são refletidas porque cada lote é completo. O snapshot pode ser
importado mesmo depois de outro refresh na origem: os arquivos já preservam
sua fotografia. Um snapshot mais antigo que o ativo é recusado; o já ativo
é reconhecido sem duplicação.

## Garantias e limites

- Falha antes da publicação mantém o lote anterior nos dashboards.
- Cada tentativa de ingestão usa UUID próprio. Lotes parciais ficam isolados.
- Não há transação distribuída entre Aiven, arquivos e Databricks. Um refresh
  bem-sucedido pode coexistir com falha posterior de exportação ou upload.
- Perder a conexão de controle antes de concluir a extração impede gerar o
  manifesto final. O exportador confere também o token da origem ao terminar.
- Refresh e lock são cooperativos: todos devem usar o procedimento previsto,
  sem REFRESH individual ou edição manual do controle.
- A publicação aponta somente para conjuntos carregados, mas não transforma
  leituras multi-table em uma transação global. Caches e gráficos separados
  podem observar momentos diferentes; atualizar os datasets após o Job e
  mostrar o lote/horário de vw_atualizacao_dashboard.
- Usar um único escritor/uma execução por vez no destino. O lock do Aiven
  protege a exportação, não serializa os Jobs que leem arquivos no Databricks.
- Não há garantia de latência zero ou disponibilidade contínua. A atualização
  periódica depende também de agendamento externo, upload, Job e quota Free.
- O refresh comum bloqueia leitura das views na origem enquanto é executado.

Referência: [garantias Delta](https://docs.databricks.com/aws/en/lakehouse/acid).

## Validações

O importador confere contrato, integridade dos arquivos, chaves não nulas e
únicas, contagens e somas, relacionamentos e participantes do ranking por perfil.
Pontos ausentes permanecem NULL com calculo_vigente_disponivel=false; o SQL
04_quality_checks.sql permite contar esses casos. Não transformar ausência de
cálculo em zero.

Hashes detectam alterações na transferência, mas o manifesto não é assinado:
o upload deve ser restrito a responsáveis autorizados. Totais não substituem
conferência amostral de nomes, chaves e datas na homologação.

## Roteiro de homologação

Em banco/workspace de teste:

1. Exportar, enviar e publicar um conjunto conhecido; comparar volumes e contagens.
2. Inserir operação, gerar novo snapshot e confirmar entrada após nova carga.
3. Corrigir/anular pelas procedures; confirmar atualização/remoção sem duplicar.
4. Conferir ranking materializado contra public.vw_annual_ranking no snapshot.
5. Testar coleta com dois motivos: uma visita e duas incidências.
6. Conferir instantes perto de meia-noite UTC e a data local de São Paulo.
7. Enviar arquivo incompleto/alterado e confirmar rejeição antes da publicação.
8. Forçar falha de carga; confirmar que o lote anterior permanece ativo.
9. Reimportar o snapshot ativo; confirmar que não duplica dados.
10. Tentar exportações concorrentes: a segunda deve falhar no lock.
11. Executar 04_quality_checks.sql e verificar joins dos dashboards.

Databricks/tests/test_ingestion_contract.py cobre funções de comparação,
manifesto e contrato entre arquivos. A regressão PostgreSQL
tests/data_mart_access_regression.sql cobre permissões, refresh, ranking e
anulação com as procedures oficiais, em base descartável. Não substituem a
homologação completa no workspace.

## Retenção

Landing preserva lotes, inclusive tentativas incompletas; o Volume e a máquina
externa preservam os arquivos exportados. Não há limpeza automática nesta
versão. Definir retenção antes da operação continuada; nunca remover lote ativo,
arquivos em upload/ingestão ou snapshots ainda usados por consultas.

Para grandes volumes, medir custo/tempo da carga integral antes de adotar
incremental/CDC, que também precisa refletir correções, anulações e dimensões.
