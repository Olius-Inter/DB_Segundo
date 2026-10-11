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
