# Validação da carga de dados

A carga foi executada em bancos descartáveis isolados, com PostgreSQL 16.15. Não foi executada no Aiven.

## Resultado da execução final

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

Na adaptação, os 11 testes existentes passaram e verificações adicionais com comandos simulados confirmaram a recusa sem confirmação do destino e o bloqueio de instalação. Esses resultados não comprovam conexão ou privilégios da conta `olius_dev_admin` no ambiente da API.

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
