# OLIUS — contrato de histórico operacional B2B (Sprint 10)

## Entrada oficial e autorização

`public.get_collection_revision_history(p_collection_id UUID, p_admin_id UUID,
p_page INTEGER DEFAULT 0, p_size INTEGER DEFAULT 20)`.

Somente a Core, pelo papel `olius_api`, recebe EXECUTE. A conta
`olius_core_api` herda esse papel. A Core fornece o ADMIN do principal autenticado,
nunca de um formulário livre; UUID não comprova identidade. O banco complementa
a autorização verificando existência, perfil ADMIN e status ACTIVE no snapshot.

Proprietário: `olius_business_owner` (NOLOGIN). SECURITY DEFINER, STABLE,
search_path `pg_catalog, public, pg_temp`, tabelas qualificadas e sem SQL dinâmico.
Reutiliza SELECTs que o proprietário já possui. Não concede SELECT nos logs à
API, não atribui papéis administrativos e não concede EXECUTE a outros leitores.
A definição fica no 04; propriedade, segurança e concessões ficam em access_control.

## Retorno tipado

Retorna um conjunto de linhas com as colunas abaixo, nesta ordem. Não devolve
JSON de snapshots, valores de pontos, revisões de cálculo nem dados cadastrais
sensíveis. UUIDs de participantes/atores são referências, não nomes/documentos.

| Coluna | Tipo PostgreSQL | Significado |
|---|---|---|
| page | INTEGER | Página solicitada, iniciando em zero. |
| size | INTEGER | Tamanho solicitado; padrão 20, mínimo 1, máximo 100. |
| total_elements | BIGINT | Total de revisões operacionais da coleta. |
| collection_id | UUID | Coleta consultada. |
| revision | INTEGER | Revisão operacional; NULL identifica página sem itens. |
| record_status | record_status_t | RECORDED ou ANNULLED naquela revisão. |
| collected_volume_liters | NUMERIC | Litros recolhidos naquela revisão. |
| presented_volume_liters | NUMERIC | Litros apresentados naquela revisão. |
| oil_condition | oil_condition_t | Condição registrada. |
| has_compromising_occurrence | BOOLEAN | Ocorrência registrada. |
| result | collection_result_t | Resultado operacional; anulação preserva o resultado anterior. |
| observation | TEXT | Observação daquela revisão. |
| failure_reason_ids | UUID[] | IDs efetivamente associados naquela revisão, ordenados por UUID. |
| failure_reason_codes | TEXT[] | Rótulos atuais do catálogo, alinhados aos IDs; elemento NULL se o catálogo não contiver mais o motivo. |
| collection_request_id | UUID | Solicitação original. |
| establishment_id | UUID | Estabelecimento da visita. |
| driver_id | UUID | Motorista registrado no fato operacional. |
| collection_date | TIMESTAMPTZ | Horário físico informado/registrado para a coleta. |
| recorded_at | TIMESTAMPTZ | created_at do lançamento original. |
| changed_at | TIMESTAMPTZ | performed_at do snapshot que iniciou a revisão. |
| corrected_at | TIMESTAMPTZ | Horário da correção, quando disponível. |
| corrected_by | UUID | ADMIN da correção, quando disponível. |
| correction_reason | TEXT | Justificativa da correção. |
| actor_kind | audit_actor_t | Contexto auditado: USER, DRIVER_FORM ou SYSTEM. |
| performed_by | UUID | Usuário autor do evento auditado, quando disponível. |
| operational_driver_id | UUID | Motorista do contexto de auditoria, quando disponível; distinto do autor ADMIN. |
| audit_reason | TEXT | Justificativa do contexto de auditoria, quando disponível. |
| audit_event_id | UUID | Identifica o evento escolhido e correlaciona BEFORE/AFTER. |

As linhas repetem page, size e total_elements; a Core usa esses três campos no
envelope da resposta e os demais na representação dos itens. Se a página estiver
vazia, a função retorna **uma linha de metadados**: collection_id e paginação
preenchidos, revision e demais campos do item NULL. A Core produz `items` somente
com linhas em que revision não seja NULL. Assim, totalElements continua disponível
sem confundir página vazia com coleta inexistente. Ler os metadados da primeira
linha antes de montar items; não aplicar WHERE revision IS NOT NULL no SQL, pois
isso descartaria os metadados da página vazia. Há sempre ao menos uma linha
quando a coleta existe e o histórico é válido.

Exemplo de chamada parametrizada pela Core:

```sql
SELECT *
FROM public.get_collection_revision_history(
    :collection_id, :authenticated_admin_id, :page, :size
)
ORDER BY revision DESC NULLS LAST, audit_event_id DESC;
```

Omitir os dois últimos argumentos aplica 0/20. NULL explícito não aplica padrão:
é parâmetro inválido. Ordenação: revision DESC, audit_event_id DESC; duplicação
de uma revisão é tratada como histórico inválido, não como um novo item.

## Reconstrução e limites dos dados existentes

O INSERT/AFTER inicia a revisão 1. UPDATE/AFTER só inicia outra revisão quando
changed_columns contém revision. O BEFORE do mesmo audit_event_id comprova o
estado anterior. Atualizações somente de points_earned são ignoradas: revisão
operacional não coincide necessariamente com revisão de cálculo.

correct_collection grava o novo estado antes de apagar os motivos anteriores e
inserir os novos. A função recupera os INSERTs de associações posteriores ao AFTER
da revisão e anteriores ao BEFORE da seguinte; os DELETEs dessa janela devem
corresponder aos motivos da revisão anterior. Anulação tem lista vazia; os motivos
anteriores continuam presentes nas revisões anteriores. A restauração é outra
revisão, com suas próprias associações.

Os logs de associações **não armazenam revision nem o evento da coleta**. Não há
identificador causal entre as duas tabelas. Usa-se a revisão e audit_event_id para
os estados e, somente para vincular associações, as fronteiras temporais existentes.
O UUID aleatório de um log não é utilizado para inventar ordem cronológica.

A função rejeita lacunas, pares ausentes, estados incompatíveis, eventos não
atribuíveis, empates nos limites, relógio regressivo detectável, duplicação de
associações e divergência com o estado vigente. Retorna 55000; não completa logs
nem cria uma revisão a partir da tabela atual. As associações atuais servem apenas
para conferir integridade do último estado, nunca para substituir as históricas.
Isso pressupõe auditoria preservada e uso das rotinas oficiais: exclusões
coordenadas de todas as evidências podem ser indetectáveis, como em qualquer
histórico sem encadeamento criptográfico. Não há alteração de modelo nesta entrega.

failure_reason_ids é o vínculo histórico. failure_reason_codes consulta o catálogo
atual apenas para exibição: não promete o código/nome antigo caso ele tenha sido
editado ou excluído. A Core deve preservar essa distinção. Não há fallback que
substitua os IDs históricos pelos motivos atualmente associados à coleta.

## Erros

| SQLSTATE | Significado para a Core |
|---|---|
| 22023 | UUID obrigatório ausente, paginação NULL/negativa ou size fora de 1–100. |
| 42501 | ADMIN inexistente/inativo/de outro perfil; ou conexão sem EXECUTE. |
| P0002 | Coleta inexistente, após validar o ADMIN. |
| 55000 | Histórico ausente, incompleto, incompatível ou temporalmente ambíguo. |

A Core trata SQLSTATE, não mensagens. Não converte 55000 em lista vazia e não
reconstitui dados silenciosamente. Erros de infraestrutura, timeout ou cancelamento
continuam com os SQLSTATEs próprios do PostgreSQL.

## Consistência e ausência de efeitos colaterais

Uma chamada é **um SELECT**. STABLE faz as leituras internas usarem o snapshot do
comando chamador: vê uma correção inteira confirmada ou o estado anterior; não
combina o fato novo com motivos antigos. Não bloqueia o escritor nem observa dados
não confirmados. READ COMMITTED é suficiente para uma única página e seu total.

Para várias chamadas/páginas com o mesmo total e conteúdo, a Core precisa usar
uma transação curta REPEATABLE READ READ ONLY. Chamadas em transações separadas
podem enxergar novas revisões e deslocar a paginação; a função não promete um
snapshot entre diferentes requisições HTTP. Autorização também é avaliada no
snapshot da transação; a Core continua responsável por validar a autenticação.

A função não faz DML, não registra uma nova auditoria de leitura e não modifica
nenhum app.audit_* / app.current_user_id / app.operational_driver_id recebido.
Toda a cadeia é validada antes da paginação: LIMIT/OFFSET não oculta lacunas.
O índice (collection_id, performed_at) de collection_failure_log atende as janelas;
o índice existente por motivo continua com finalidade diferente.

## Instalação e migração

Base nova: seguir 01–08, catálogo e access_control; não há novas tabelas, colunas,
fórmulas, regras de correção nem tipos auxiliares. Base instalada: executar somente
`migrations/20261030_collection_revision_history.sql` inteira, fora de outra
transação, com implantador autorizado descrito no cabeçalho. Não executar 01–03.

A migração cria a função, revoga PUBLIC e configura proprietário/segurança/EXECUTE
na mesma transação. Cria o índice, valida índices preexistentes e é reaplicável.
Não altera dados, histórico ou papéis de consumidores. Recusa concessões padrão
inesperadas e leitura direta preexistente dos logs pela Core; esses problemas devem
ser revisados no controle de acesso, não contornados aqui. Em erro, ROLLBACK.

CREATE INDEX é transacional e pode aguardar/bloquear gravações dos logs durante a
construção: planejar janela de implantação se a auditoria for grande. Nenhuma
execução em desenvolvimento compartilhado ou produção está autorizada por este documento.

As consultas pós-COMMIT devem mostrar owner=olius_business_owner, prosecdef=true,
provolatile=s, search_path seguro, api_execute=true e ambos api_reads_*_log=false.
O teste de migração compara o contrato com a instalação nova e verifica reaplicação,
instalação sem superusuário, preservação de fatos/logs e leituras concorrentes.

## Arquivos da entrega e validação

| Arquivo | Alteração |
|---|---|
| 03_indexes.sql | Índice da janela temporal das associações de motivos. |
| 04_functions_procedures.sql | Definição tipada e somente leitura da função. |
| access_control/01_roles.sql | Propriedade, SECURITY DEFINER e EXECUTE somente para olius_api. |
| access_control/API_DATABASE_CONTRACT.md e README.md | Integração da Core e documentação do acesso. |
| migrations/20261030_collection_revision_history.sql | Atualização transacional/reaplicável sem alteração de dados. |
| migrations/README.md | Ordem e instruções da nova migração. |
| tests/collection_history_regression.sql | Revisões, motivos, paginação, atores, corrupção/ambiguidade e permissões. |
| tests/collection_history_migration_regression.py | Instalação/migração equivalentes, falhas seguras e concorrência. |
| tests/run_ci.py | Integração das regressões na esteira existente. |
| tests/api_access_regression.sql | Contagem atualizada para 19 rotinas sob o proprietário de negócio. |
| tests/README.md | Escopo das novas regressões. |
| sonar-project.properties | Exclui apenas a cópia canônica da migração da comparação de duplicação; igualdade é exigida pelo teste. |
| COLLECTION_REVISION_HISTORY.md | Contrato completo e limitações desta entrega. |

Não houve alteração em 01_structure.sql, 02_check_constraints.sql, 05_triggers.sql,
06_ctes.sql, 07_window_functions.sql ou 08_materialized_views.sql. O catálogo não
precisa de carga nova: não foram criadas tabelas, colunas ou papéis documentais.
EXECUTE na consulta não transforma olius_api em leitor direto dos logs na view
do catálogo. Fórmulas, consumo, recorrência, certificados, correct_collection,
dados iniciais e código da Core/Redis não foram alterados.

Validação local desta entrega: quinze regressões SQL passaram, incluindo a nova
consulta; migração aplicada duas vezes sem SUPERUSER com dados e auditoria
preexistentes preservados; rejeição de índice incorreto, concessões padrão
indevidas e leitura direta indevida pela Core; commit durante a própria consulta
e snapshot repetível em transação READ ONLY. Também passaram instalação 01–05
sem SUPERUSER, migração anterior de visitas, carga oficial e quatro testes do
exportador/orquestração de cobertura.

A validação começou em PostgreSQL 18 isolado e foi complementada no PostgreSQL
16.15 com a mesma imagem/profiler do CI. A suíte run_ci.py completa passou,
incluindo regressões SQL, migrações, instalação sem SUPERUSER, concorrência e
exportação de cobertura. A nova função teve 57/57 linhas de instruções medidas
exercitadas (100%). Esse percentual é da função; a análise remota do Sonar continua
dependente de novo push/execução da esteira.

A carga de demonstração completa também passou no PostgreSQL 16.15, incluindo
instalação dos papéis. Uma consulta usando a conta limitada da Core validou todas
as 200 coletas e 202 revisões dessa massa, sem incoerência. Relatórios ficam em
coverage/ (ignorados pelo Git), incluindo postgresql.xml e
history-validation-summary.json. Não houve execução em Aiven ou banco real de
desenvolvimento/produção. As restrições de cobertura/qualidade não foram reduzidas;
a exclusão de duplicação refere-se somente ao snapshot canônico da migração.
