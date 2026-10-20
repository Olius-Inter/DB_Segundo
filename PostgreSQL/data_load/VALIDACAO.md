# Validação da carga de dados

A carga foi executada em bancos descartáveis isolados, com PostgreSQL 16.15. Não foi executada no Aiven.

## Atualização de 20/10/2026 — carga oficial compartilhada

A configuração inicial agora vem de `../initial_data/`, com 16 registros: 3 planos,
3 níveis de certificados, 7 tipos de estabelecimento e 3 motivos. O JSON da
simulação contém apenas a seed. As seções seguintes são evidências históricas;
as antigas referências a metas pendentes e ausência de certificados não descrevem
mais o comportamento atual.

Validação desta entrega, exclusivamente em containers novos e isolados com
PostgreSQL 16.15; nenhuma execução no Aiven ou banco de produção:

- Carga oficial em banco vazio: 16 registros, nenhum usuário/operação/concessão.
- Duas cargas oficiais simultâneas: sucesso sem duplicidade.
- Reexecução: IDs, timestamps, valores e quantidades de logs inalterados.
- ID preexistente compatível e categoria adicional legítima preservados.
- Preço divergente e nome de certificado duplicado recusados; rollback integral,
  incluindo inserções tentadas antes da divergência e seus logs.
- Validador de somente leitura confere o contrato independentemente.
- Carga completa com scripts 01–08, catálogo, papéis e jornadas sob `olius_api`:
  112 usuários, 240 solicitações, 200 coletas, 400 entregas, 598 fatos RECORDED,
  600 cálculos vigentes, 35 históricos, 33 pagamentos simulados e **15 certificados**
  gerados pelas rotinas existentes. Metas: 100, 500 e 1.000 L.
- Modo desenvolvimento em outro banco já estruturado e com os 16 registros:
  carga completa aprovada, reutilizando as referências.
- Nova tentativa na base populada: recusada antes da carga oficial/simulações;
  600 fatos e 15 certificados permaneceram preservados.
- Suíte PostgreSQL completa do CI aprovada, incluindo auth, negócios, acessos,
  Data Mart, nova regressão de carga inicial, concorrência e exportação de cobertura.
- Suíte Python do runner: 20 testes, 19 aprovados e 1 ignorado por restrição de
  criação de symlink no Windows; cobertura de **96% (214/223 instruções)**.

A regressão real da carga oficial é chamada automaticamente por `tests/run_ci.py`.
Aprovação do Sonar/CI remoto depende de commit, push e nova execução; não foi
alterado nenhum Quality Gate. As MVs de BI continuam exigindo refresh pelo fluxo
oficial após popular a demonstração. Não há provedor financeiro real nem envio
para Redis nesta carga.

## Resultado histórico da execução inicial

Base técnica: scripts locais do projeto no commit `4e24c67a0b0743cc0b2865a81f5fa9d5d0be2ac8`, incluindo catálogo e controle de acesso. As jornadas foram executadas com o papel `olius_api`; instalação, cadastros iniciais e contratos foram preparados pela conta administrativa do ambiente de teste.

| Registro | Quantidade |
|---|---:|
| Usuários da aplicação | 112 |
| Cidadãos | 80 |
| Estabelecimentos | 30 |
| Motoristas | 5 |
| PEVs | 8 |
| Solicitações | 240 |
| Coletas | 200 |
| Entregas | 400 |
| Operações válidas após duas anulações | 598 |
| Pagamentos simulados | 33 |
| Aplicações de pagamento | 32 |
| Upgrades | 2 |
| Reembolsos solicitados | 1 |
| Cálculos de pontos atuais | 600 |
| Cálculos de pontos históricos | 35 |

Volume dos fatos válidos: 2.971,25 L coletados e 3.540,75 L entregues.

## Verificações aprovadas

- Instalação e execução dos scripts com interrupção em caso de erro.
- Reenvios com a mesma chave de idempotência sem duplicação de pedidos ou entregas; reaplicação de pagamento sem novo benefício.
- Coletas bem-sucedidas e malsucedidas, motivos de falha, solicitações pendentes e rejeitadas, cancelamentos livres e com perda de franquia.
- Correções e anulações com revisão e auditoria.
- Saldos conferidos por cálculo independente e consumo de franquias dentro dos limites.
- Vínculos entre PEV, responsável e cidadão, incluindo impedimento de autovalidação.
- Cinco testes automatizados do runner aprovados.
- Segunda execução no banco já populado recusada antes da carga; os 600 fatos originais permaneceram intactos.

Também foi executada uma carga de compatibilidade com a versão da PR #21 (`51e3b9fa915618e02dd8a410c31b3d67443d5119`), incluindo as views anuais. Essa verificação não substitui a revisão das permissões dessas views.

## Limites desta entrega

- Os três planos usam valores oficiais dos documentos. Pagamentos são simulados, sem chamadas a provedores.
- Nomes e metas de certificados permanecem pendentes; nenhuma meta fictícia ou certificado foi criado.
- Esta massa não demonstra a décima coleta bem-sucedida de um mesmo estabelecimento: o maior plano permite oito solicitações por ciclo. Esse cenário exige massa histórica específica.
- A execução original foi validada localmente em containers. Na revisão DevOps, o CI passou a executar os testes do runner com cobertura Python e a carga completa em outro container.
- O runner gera logs e um manifesto JSON com hashes dos scripts em `reports/`, pasta ignorada pelo Git.

## Revisão DevOps

Ampliada a suíte para 11 testes, incluindo argumentos inválidos, erros de comandos, configuração, instalação, manifesto, recusa de banco populado e validação dos caminhos temporários. Os 11 testes passaram localmente, com cobertura de 94% do runner (142 de 151 instruções). A cobertura também será medida pelo workflow.

A aprovação do Quality Gate depende da nova análise remota após o push. Os alertas de complexidade do runner foram tratados separando validação de plano, instalação e execução das etapas; as regras SQL e a distribuição da massa foram preservadas.

Nesta revisão, o Docker local não respondeu à inicialização, impedindo repetir a carga completa com o runner alterado. A execução real original continua registrada acima; os testes de orquestração usam comandos simulados. O novo CI inclui a repetição real em container independente.

## Modo de desenvolvimento

O runner também aceita `--development` e `--user`, mediante confirmação exata de `container/banco` em `OLIUS_DATA_LOAD_DEVELOPMENT_TARGET`. Esse modo bloqueia instalação de estrutura/permissões e mantém a recusa de tabelas populadas, além de conferir a presença das tabelas principais.

Na adaptação inicial, os 11 testes existentes passaram e foram feitas verificações auxiliares simuladas. As proteções agora possuem testes permanentes em `test_runner.py`: `test_docker_development_confirmation_and_installation_guards` cobre a confirmação exata de `container/banco` e a recusa de reinstalação; `test_direct_target_requires_exact_confirmation_and_existing_structure` cobre os contratos equivalentes da conexão direta. O resultado esperado é `ValueError` nos destinos sem confirmação e nas tentativas de instalação em desenvolvimento. Esses testes não comprovam conexão ou privilégios da conta `olius_dev_admin` no ambiente da API.

Para reproduzir, na raiz do repositório, sem conexão ao banco:

```powershell
python -m unittest discover -s PostgreSQL/data_load -p test_runner.py -v
```

Não foi executada carga real no destino informado (`olius-local` / `postgres-dev`). Os nomes, a autenticação, a estrutura completa e as permissões devem ser confirmados na execução. O CI continua utilizando exclusivamente o modo descartável.

## Adaptação para conexão direta

O runner passou a aceitar `--host`/`--port` como alternativa a `--container`. Usa o cliente psql local, conserva variáveis/includes dos scripts e não copia nem remove arquivos no servidor remoto. Os comandos Docker existentes permanecem compatíveis.

A conexão direta exige modo de desenvolvimento, confirmação exata de `host:porta/banco`, estrutura existente e tabelas vazias. Instalação de estrutura e permissões continua restrita ao modo Docker descartável. PostgreSQL 16.15 permanece sendo a versão admitida.

TLS usa `verify-full` por padrão, com opção para arquivo CA. Credenciais são lidas pelo cliente PostgreSQL, sem senha em argumentos do runner ou no manifesto. O modo sem TLS exige escolha explícita.

A suíte foi ampliada para 17 testes, todos aprovados localmente, com cobertura de 96% do runner (200 de 209 instruções). Cobre a montagem da conexão direta, confirmação de destino, validação de host/porta, certificado ausente ou inválido, ambiente de autenticação/TLS, arquivos locais preservados, execução das etapas com comandos simulados e recusa de estrutura ausente ou dados existentes.

Não foi realizada carga no Aiven nem no banco da API nesta adaptação. O Docker local não respondeu após sua inicialização, impedindo a repetição integrada. A suíte com comandos simulados não comprova handshake TLS, conectividade ou permissões de uma conta remota. O cliente psql instalado localmente foi identificado como 18.2; a restrição 16.15 do runner refere-se ao servidor PostgreSQL.

## Correção dos apontamentos da PR #24

Na execução remota `38924733620`, regressões, cobertura e a carga completa passaram. O job foi reprovado na etapa Sonar pelo Security Rating C: o caminho de `--report-dir` podia direcionar a escrita do manifesto para fora das pastas de saída do projeto (`pythonsecurity:S8707`). Também foram apontados quatro testes com mais de uma chamada dentro da verificação de exceção (`python:S5778`).

Os relatórios agora ficam restritos a `PostgreSQL/data_load/reports/` e `coverage/`, incluindo subpastas. A validação resolve caminhos antes da conferência, rejeita escapes e links para fora dessas raízes e recusa arquivos de relatório simbólicos. O destino atual do CI permanece aceito. Os argumentos dos quatro testes foram preparados antes dos blocos de exceção.

A suíte passou a ter 20 testes: 19 passaram localmente e um teste com symlink real foi ignorado por falta de permissão no Windows; ele permanece na suíte para execução no CI Linux. O bloqueio de arquivos simbólicos também foi verificado com simulação. Cobertura local do runner: 96% (216 de 225 instruções). Não houve carga em banco nem alteração de SQL, permissões ou configuração do Sonar nesta correção. A aprovação remota exige novo push e nova execução da análise.

## Complemento da revisão da PR #24

A verificação de estrutura agora consulta `pg_catalog.pg_class` e `pg_catalog.pg_namespace`, exigindo as cinco tabelas ordinárias no schema `public` (`relkind='r'`). Sequências, views e outros tipos de relação não satisfazem essa pré-condição. A verificação permanece limitada a essas cinco tabelas; ela não certifica toda a versão do schema.

O README passou a descrever corretamente o fallback de `journeys_role` para `--user`. As verificações auxiliares de confirmação do modo Docker foram incorporadas à suíte permanente, com comando reproduzível acima.

Após esse complemento: 21 testes na suíte, com 20 aprovados e um teste de symlink real ignorado pela restrição de criação de links no Windows. Cobertura do runner: 96%. A validação da resposta do PostgreSQL continua simulada nos testes unitários; nenhuma carga foi executada nesta correção.

Justificativa para revisão do alerta Sonar `AaFFcEt4idhKYWVJX5nK` (`pythonsecurity:S8707`): o fluxo apresentado acompanha `args.host` até `manifest['target']['host']`, depois `json.dumps(manifest)` e o argumento de conteúdo de `Path.write_text`. O valor do host não compõe o caminho do arquivo. O caminho é produzido separadamente por `report_directory` e `report_file`, com raízes de saída restritas, validação de nome e recusa de links simbólicos. Por isso, recomenda-se marcar esse apontamento específico como falso positivo, preservando a regra e a análise do arquivo. Essa classificação não foi alterada pelo script nem por exclusão na configuração do Sonar.


## Nova análise da PR #24 — commit 49d6866

Na execução 38992798886 (job 117278640897), passaram as regressões SQL, concorrência, os 21 testes do runner e a carga completa em container. A cobertura Python foi 96%. A falha aconteceu exclusivamente em SonarQube Scan, com exit code 3 após o Quality Gate reprovar Security Rating C. Os dois checks vermelhos derivam desse mesmo bloqueio; as três conversas de revisão anteriores já estão resolvidas.

O único apontamento aberto era AaFFcEt4idhKYWVJX5nK (pythonsecurity:S8707), na gravação do manifesto. O fluxo relatado liga o host ao conteúdo JSON, não ao caminho. A gravação foi ajustada para abrir o caminho validado separadamente e serializar com json.dump em um arquivo já aberto. O conteúdo, os campos e as restrições de destino permanecem preservados. Nenhuma regra do Sonar ou condição do Quality Gate foi desativada.

O teste de orquestração direta agora verifica host e banco no JSON e uma falha contendo um caminho relativo e caracteres Unicode: a mensagem deve permanecer como dado no manifesto, sem criar arquivo no caminho mencionado. Após a alteração, 20 testes passaram e um foi ignorado por restrição de symlink no Windows; cobertura de 96% (218/227 instruções). Os testes locais simulam as chamadas PostgreSQL, mas gravam e conferem os relatórios reais em diretórios temporários. Não foi executada carga em banco nesta correção.

A aprovação pelo Sonar ainda exige análise remota do próximo commit. Se o mesmo apontamento persistir, deve ser revisado como falso positivo com base no fluxo comprovado, sem suprimir a regra nem afirmar aprovação antes do resultado remoto.


## Correção da PR #28 — duplicação no validador

No commit 7b8067c, a execução 39422560216 (job 118626928370) passou nas
regressões SQL, concorrência, testes Python/Databricks e carga completa. A etapa
Sonar falhou com exit code 3: 178 linhas novas duplicadas em 468 (38,0%), acima
do limite de 3%. O bloco de 89 linhas aparecia tanto em initial_data/01_reference_data.sql
(linha 18) quanto em initial_data/02_validate.sql (linha 9). O CI de push passou
porque a análise Sonar nessa branch é executada no evento de PR, não de push.

O validador foi reescrito com CTEs, relações VALUES e comparação agregada entre
registros esperados e existentes. Deixou de copiar o catálogo JSON, loops e SQL
dinâmico da instalação. Continua independente, em REPEATABLE READ READ ONLY,
validando os mesmos 16 registros, valores e duplicidades, aceitando IDs existentes
e registros adicionais legítimos. Não foram alterados os dados oficiais, a carga
de instalação, os filtros do Sonar nem o Quality Gate.

A regressão ganhou seis cenários de divergência (vagas, litros, meta, categoria,
status e descrição NULL), conferindo também que a validação não modifica dados
ou logs. A suíte PostgreSQL completa passou novamente em PostgreSQL 16.15
descartável, incluindo a regressão da carga oficial, acessos, Data Mart e
concorrência. A carga completa também passou com olius_api: 600 operações,
598 RECORDED e 15 certificados, com valores e contagens preservados.

Nenhuma execução em produção/Aiven. A medição atualizada de duplicação e a
aprovação do Quality Gate precisam da nova análise remota após commit/push;
a aprovação do Sonar não foi presumida a partir dos testes locais.
