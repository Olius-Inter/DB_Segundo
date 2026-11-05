# Validação ponta a ponta pelo scheduler

Executor: Airflow 3.3.2 LocalExecutor, PostgreSQL 16.15, certificados TLS efêmeros.
Script: airflow/tests/scheduler_check.py. Utiliza apenas fixtures em rede Docker
interna, sem Aiven, .env, pastas reais de histórico ou credenciais existentes.

## Cenários

1. Extração READ ONLY, preparo, rejeição do CPF AES-GCM sem chave, carga do cidadão
   válido, reconciliação, arquivo criptografado e backup: execução bem-sucedida.
2. Nova execução do mesmo conteúdo: não duplica, preserva nome/hash alterados no
   destino e reconhece a proveniência já confirmada.
3. Nova identidade com erro forçado no INSERT: rollback da unidade e da auditoria;
   histórico é produzido e a DAG termina FAILED, sem mascarar a falha da carga.
4. Nova execução após remover a falha fictícia: importa só a unidade pendente,
   preserva as já confirmadas e não cria pontos ou sessões.

A rejeição de CPF é deliberada. Não é descriptografado nem substituído; a ausência
de CPF_CHAVE continua sendo pendência real. As contas/certificados/campos dos
testes são fictícios e não representam informações recuperadas do legado.

## Correção encontrada pela execução real

O parâmetro run_id das funções de tarefa colidia com uma chave reservada do
contexto Airflow. O teste da função isolada não reproduzia a chamada do operador.
As tarefas agora usam batch_id. Um teste de contrato impede reintroduzir nomes
reservados. O ID externo da execução continua acessado pelo contexto para derivar
a identificação estável do lote; o contrato dos módulos Python não mudou.

O histórico consulta explicitamente o XCom de extração, sem exigir que uma tarefa
falha publique resultado. Sem lote preparado, é SKIPPED. A tarefa final none_failed
continua impedindo que o all_done do histórico esconda falhas da carga.

## Como repetir

Na raiz do repositório, com Docker e dependências de legacy_rpa_etl instaladas:

```powershell
docker build --target validation -t olius-legacy-airflow:validation -f PostgreSQL/legacy_rpa_etl/airflow/Dockerfile PostgreSQL/legacy_rpa_etl
$env:OLIUS_ETL_DISPOSABLE='1'
python PostgreSQL/legacy_rpa_etl/airflow/tests/scheduler_check.py --repo (Get-Location).Path --report coverage/scheduler-validation/report.json
```

O teste cria nomes únicos e rótulos próprios, sem publicar portas. Remove seus
containers, volume e rede ao terminar. Em encerramento forçado do processo,
recursos podem permanecer: conferir rótulos antes de qualquer limpeza manual.
Não remover containers do ambiente pessoal ou da API.

O relatório contém estados das tarefas e contagens, sem dados de titulares,
senhas, certificados privados ou chaves. O CI possui job separado para repetir
os cenários e publicar esse relatório. A validação local não garante aprovação
remota do CI ou do Sonar.

## Limites

Não é uma migração real nem um teste da Core Java. A compatibilidade da Core foi
validada em sua revisão própria. Sincronização OneDrive, acesso de Pedro/Caio,
recuperação das chaves por Caio e política de retenção dependem do ambiente real.
O teste agora inclui também um B2B e um motorista fictícios, com complementos
privados gerados temporariamente, controle técnico separado e carga ampliada
habilitada apenas na rede interna. Confere o reenvio sem substituir a senha do B2B,
a existência de uma única proveniência por cadastro e a preservação no histórico
dos campos sem equivalente. O relatório registra imported_establishments=1 e
imported_drivers=1, além dos dois cidadãos. Isso não autoriza carga real nem cria
mapeamento para fatos operacionais.
