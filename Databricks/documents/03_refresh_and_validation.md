# Atualização, publicação e validação

## Como uma carga acontece

1. O Python verifica o controle do destino e gera um lote UUID novo.
2. Abre uma conexão PostgreSQL direta e adquire advisory lock de sessão.
3. Chama dm.refresh_data_mart em REPEATABLE READ: todas as views recebem a
   mesma fotografia da aplicação, e o snapshot_id muda no mesmo commit.
4. Mantém o lock enquanto lê as views via JDBC e grava cada conjunto no
   destino com _lote_id. O banco operacional continua recebendo operações;
   as views permanecem congeladas até o próximo refresh autorizado.
5. Confere tipos, chaves únicas/não nulas, contagens, somas de medidas e
   relacionamentos. Verifica que o snapshot_id não mudou na extração.
6. Atualiza uma única linha da tabela publicacao, trocando o lote ativo.
7. Libera a conexão/lock. As views de consumo passam a selecionar o novo lote.

Novas operações após a fotografia entram na próxima execução. Correções e
anulações são refletidas porque cada lote é uma fotografia completa: uma
operação removida da origem não aparece no lote novo. Não usar append simples
em uma única tabela de consumo para representar esse comportamento.

## Garantias e limites

- Uma falha antes da publicação mantém o lote anterior nos dashboards.
- Cada tentativa usa UUID próprio. Lotes parciais ficam isolados, sem misturar
  dados publicados ou duplicar linhas do lote ativo.
- Não há transação distribuída PostgreSQL/Databricks. Um refresh bem-sucedido
  pode existir na origem mesmo se a transferência falhar; o destino mantém
  o último lote validado e registra a defasagem pelo horário de publicação.
- A troca do ponteiro é uma única transação Delta; não exige atualizar todas
  as tabelas Delta em uma transação conjunta.
- Todos os escritores devem usar este fluxo e o mesmo controle. Não executar
  REFRESH individual, editar landing manualmente ou mudar publicacao fora dele.
  O lock é cooperativo; não impede um administrador de ignorar o protocolo.
- Uma conexão de controle perdida impede o Python de publicar. O token final
  também detecta refresh concorrente pelo procedimento. Redução de bloqueios
  ou extração paralela exigem preservar a fotografia de origem.
- A publicação só aponta para conjuntos cuja carga já terminou. Isso não cria
  uma transação de leitura entre todas as tabelas Delta: consultas já em execução
  durante a troca, caches e gráficos separados podem observar momentos diferentes.
  Atualizar os datasets após a carga, sem sobreposição com a próxima publicação,
  e mostrar lote/horário de vw_atualizacao_dashboard. Para exigir uma fotografia
  transacional entre tabelas em qualquer instante, avaliar transações multi-table
  suportadas pelo ambiente ou datasets fixados a um lote/versões específicas.
- Consistência não significa disponibilidade contínua ou latência zero: falha
  de rede/Job pode atrasar os dados. Configurar alertas e acompanhar a última
  atualização concluída. O refresh comum bloqueia leitura das views na origem.

Referência: [garantias Delta](https://docs.databricks.com/aws/en/lakehouse/acid).

## O que é validado automaticamente

- Origem e destino têm os tipos declarados no contrato.
- Cada linha contém todas as partes da chave; não há chaves repetidas.
- Quantidade de linhas e somas de medidas coincidem com o snapshot da origem.
- Datas, estabelecimentos, motoristas, PEVs, cidadãos, classificações, status
  e motivos referenciados existem no mesmo lote.
- Ponte refere-se apenas a coletas válidas carregadas.
- Operações sem cálculo vigente são reportadas, permanecendo com pontos NULL.

Contagens e totais conferem as métricas, mas não provam igualdade de todo campo
descritivo. Na homologação, conferir amostras de chaves, nomes e datas também.
Mudança de schema falha de forma explícita; não há evolução automática de colunas.

## Roteiro de homologação

Em banco/workspace de teste:

1. Publicar um conjunto conhecido e comparar totais no PostgreSQL e Databricks.
2. Inserir uma operação e verificar sua entrada após nova carga.
3. Corrigir volume/pontos de uma operação; confirmar atualização sem duplicação.
4. Anular coleta e entrega; confirmar remoção das fatos e preservação do pedido.
5. Usar coleta com dois motivos; conferir uma visita no dashboard e duas incidências.
6. Conferir timestamps perto de meia-noite UTC com data local America/Sao_Paulo.
7. Forçar falha antes de publicar, por exemplo retirando MODIFY de uma tabela
   no ambiente de teste; confirmar que o lote ativo anterior permanece.
8. Executar duas cargas; a segunda deve falhar no lock, sem corromper a primeira.
9. Verificar que o SQL 04 não encontra perda/duplicação nos joins de consumo.

Os testes locais em Databricks/tests/test_ingestion_contract.py validam funções
de comparação e o contrato entre arquivos. Não substituem esse roteiro real.

## Retenção e crescimento

As tabelas landing preservam todos os lotes, inclusive tentativas incompletas.
Isso facilita recuperar e auditar a carga, mas aumenta o armazenamento. Não há
limpeza automática nesta versão. Antes de operação continuada, definir retenção
e manutenção com a equipe: remover somente lotes antigos que não sejam o lote
ativo nem uma execução em andamento. Nunca fazer limpeza concorrente com carga
ou consultas que ainda dependam de snapshots antigos.

Para volumes grandes, medir tempo e custo da carga integral antes de adotar
incremental/CDC. Incremental precisa tratar atualizações, exclusões e mudanças
dimensionais; filtrar somente created_at não atende às correções do projeto.
