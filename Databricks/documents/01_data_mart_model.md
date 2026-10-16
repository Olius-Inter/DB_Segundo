# Modelo do Data Mart

As views materializadas do PostgreSQL são o recorte analítico da aplicação.
Seus resultados alimentam tabelas Delta no Databricks. Sobre essas tabelas,
views comuns expõem apenas o lote publicado e montam os datasets do BI.

## Fatos

| View de origem / objeto no destino | Grão | Fontes | Medidas principais |
| --- | --- | --- | --- |
| `fato_coleta` | Uma visita B2B RECORDED | collection, collection_request, point_calculation | Volumes coletado/apresentado/estimado, pontos nominais, quantidade |
| `fato_entrega_pev` | Uma entrega B2C RECORDED | delivery_pev, point_calculation | Litros entregues, pontos nominais, quantidade |
| `fato_solicitacao` | Um pedido, em seu estado atual | collection_request, collection, collection_schedule_history | Estimativa, franquia perdida, vagas perdidas, reagendamentos e tempos |

Visitas malsucedidas registradas continuam contribuindo com seu volume real
e sua quantidade. Anulados ficam fora das fatos de operações. A solicitação
permanece mesmo se sua coleta for anulada; nesse caso, coletada_em e tempo
até coleta ficam NULL. O pedido aprovado não deve ser interpretado sozinho
como prova de uma visita válida.

Agendamento inicial não é reagendamento. Contamos registros com horário
anterior não nulo e diferente do novo. A agregação ocorre antes do join, para
não multiplicar as solicitações.

## Dimensões e relacionamentos

| Dimensão | Fontes | Fatos consumidoras |
| --- | --- | --- |
| dim_tempo | Calendário gerado em dias, por anos inteiros | Todas |
| dim_estabelecimento | establishment + users + establishment_type + addresses | Coleta e solicitação |
| dim_motorista | driver | Coleta |
| dim_cidadao | citizens + users | Entrega |
| dim_pev | pev + addresses | Entrega |
| dim_classificacao_coleta | Combinações dos enums de resultado/condição e booleano de ocorrência | Coleta |
| dim_status_solicitacao | Enum de status da solicitação | Solicitação |
| dim_motivo_falha | collection_failure_reason | Ponte |

`ponte_coleta_motivo` vem de collection_failure e contém uma linha por par
coleta/motivo. Não juntar diretamente essa ponte à fato para somar volumes
ou pontos. Use EXISTS ou uma seleção DISTINCT de coleta_id para filtrar a fato.
A view de falhas expõe apenas identificação e descrições, sem medidas de volume.

As chaves UUID viram strings com o mesmo valor; nunca são renumeradas.
data_id é DATE. classificacao_id combina três valores estáveis. Os índices
únicos protegem os grãos na origem; o Python valida unicidade e relacionamentos
no destino. `solicitacao_id` na fato de coleta identifica o pedido, sem precisar
de uma dimensão exclusiva para cada solicitação.

Dimensões mostram o **cadastro atual**, inclusive registros inativos para
preservar os joins históricos. Nome, cidade, categoria e coordenadas antigos
não são reconstruídos. Histórico dimensional tipo 2 exige outra implementação.
Os dados de operação são históricos; o status da solicitação é um snapshot
atual, não o status que ela tinha em cada dia passado.

## Datasets dos dashboards

| View no Databricks | Uso |
| --- | --- |
| vw_coletas_dashboard | Comparar categorias/motoristas, qualidade e volumes |
| vw_entregas_dashboard | Volume por PEV e participação B2C |
| vw_solicitacoes_dashboard | Situações dos pedidos, cancelamentos, reagendamentos e tempos |
| vw_falhas_dashboard | Contar incidências por motivo |
| vw_volume_operacoes_dashboard | Evolução ambiental B2B/B2C em um dataset comum |
| vw_atualizacao_dashboard | Mostrar última atualização da origem e publicação |
| vw_ranking_dashboard | Pontuação e posição anuais aprovadas, por perfil |

## Ranking aprovado

dm.ranking_anual materializa public.vw_annual_ranking, que já utiliza a window
function aprovada. O Data Mart não repete esse cálculo. O contrato considera
somente o ano corrente em America/Sao_Paulo, com empate 1,1,2 e perfis separados.
Ordenar o dataset explicitamente por perfil, ano, posicao e participante_id.
Os lotes técnicos não substituem uma política de histórico anual do ranking.

Manter as linhas individuais possibilita histograma de litros, boxplot por
categoria/PEV e distribuição dos tempos. Agregar apenas na consulta do gráfico.

## Indicadores e filtros

- Barras e linhas: SUM(volume_litros) e SUM(quantidade_operacoes) por data,
  perfil, cidade ou grupo. Para intervalos sem operações, partir de dim_tempo
  e fazer LEFT JOIN ao agregado; ausência de linha não é automaticamente zero.
- Cards: litros, visitas, entregas, COUNT(DISTINCT participante_id) e taxa
  de sucesso = SUM(quantidade_sucessos) / SUM(quantidade_coletas) * 100.
- Desvio de volume: volume real menos estimado; percentual com denominador
  maior que zero. Para o total, usar diferença das somas dividida pela soma
  estimada, não média dos percentuais por coleta.
- Comparação entre períodos: aplicar os mesmos filtros a dois intervalos
  equivalentes. Percentual fica NULL se o total anterior for zero. Nenhuma
  window function é implementada nesta etapa.
- Mapas: agrupar por estabelecimento/PEV e coordenadas. Coordenadas NULL
  ficam fora do mapa; não substituir por 0,0. No B2C, localização é do PEV.
  A escolha do mapa e seu suporte devem ser conferidos no workspace.
- Filtros: período, perfil, cidade, categoria, motorista, PEV, resultado e
  status, conforme os campos disponíveis em cada dataset.

Datas dos fatos usam America/Sao_Paulo. Instantes TIMESTAMP exportados em Parquet
preservam UTC; datas locais de solicitação/agendamento podem ser obtidas
com from_utc_timestamp no Databricks. A análise de solicitações usa a data
do pedido, e a de coletas usa a data física da visita.

Tempo até coleta = collection_date menos request_at, em horas. Desvio de
chegada = arrived_at menos scheduled_at, em minutos; negativo indica chegada
antecipada, positivo indica atraso. Essa comparação usa o horário atual do
pedido, não reconstrói sua sequência de agendamentos. Ausência de horários
fica NULL e não deve entrar como atendimento de duração zero.

Pontos usam apenas point_calculation.is_current. Cálculo ausente mantém a
operação para volume e contagem, mas deixa pontos NULL com um indicador de
disponibilidade. Pontos nominais podem ser negativos; sua soma não reproduz
saldo geral nem ranking anual B2B com piso zero sequencial.

Franquia perdida por cancelamento não entra no volume ambiental. Entregas
B2C não contribuem para certificados de estabelecimentos. Financeiro,
assinaturas, certificados e componentes dos pontos estão fora deste
recorte. Nomes de pessoas são incluídos para identificação: restringir acesso
às views de cidadãos e motoristas conforme o público dos dashboards.
