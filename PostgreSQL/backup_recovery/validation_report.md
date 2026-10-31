# Evidência de recuperação — 30/10/2026

Resultado: **PASS**, código de saída **0**. Execução local real com os
binários Windows PostgreSQL **16.15**, sem acesso à Aiven ou a dados reais.
Base do código: commit `390b7b934b01bd9284feb110330e0ea769758121` mais os
arquivos de recuperação desta revisão.

## Comando executado

Na raiz do checkout:

```powershell
& 'C:\Program Files\Python314\python.exe' -u PostgreSQL/backup_recovery/validate_recovery.py --pg-bin 'C:\Program Files\PostgreSQL\16\bin' --port 55488
```

O runner cria dois clusters independentes via `initdb`, inicia ambos com
`pg_ctl -o "-h 127.0.0.1 -p PORTA"` nas portas 55488/55489 e os encerra ao terminar.
Não remove diretórios existentes. O superusuário `lab_super` apenas cria:

```sql
CREATE ROLE recovery_admin LOGIN INHERIT NOSUPERUSER CREATEDB CREATEROLE
    NOREPLICATION NOBYPASSRLS;
```

A conta `recovery_admin` executa `provision_roles.sql`, cria os bancos com
`template0`, instala 01–08, o catálogo 01–04 e SOMENTE ENTÃO instala
`access_control/01_roles.sql` e `02_users.sql` na origem artificial.
Os fixtures de `tests/fixtures_procedures.sql` fornecem registros sintéticos;
o schema auxiliar `olius_test` é removido antes do backup. As materializadas
são atualizadas com:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
CALL dm.refresh_data_mart();
COMMIT;
```

## Comandos centrais usados pelo runner

Com os binários da pasta acima no Path e `$Pasta` apontando para
`PostgreSQL/backup_recovery`:

```powershell
pg_dump -h 127.0.0.1 -p 55488 -U recovery_admin -w -d olius_backup_source --format=plain --file="$Pasta/artifacts/backup-lab.sql"

# Controle negativo: esperado código 3, permission denied for schema public.
psql -X -w -h 127.0.0.1 -p 55489 -U recovery_admin -d olius_backup_recovered --set=ON_ERROR_STOP=1 --single-transaction --file="$Pasta/artifacts/backup-lab.sql"

# Recuperação corrigida: esperado código 0.
psql -X -w -h 127.0.0.1 -p 55489 -U recovery_admin -d olius_backup_recovered --set=ON_ERROR_STOP=1 --set=source_database=olius_backup_source --single-transaction --file="$Pasta/prepare_restore.sql" --file="$Pasta/artifacts/backup-lab.sql" --file="$Pasta/finish_restore.sql"
psql -X -w -h 127.0.0.1 -p 55489 -U recovery_admin -d olius_backup_recovered --set=ON_ERROR_STOP=1 --file="PostgreSQL/access_control/02_users.sql"
```

Repete-se a recuperação corrigida em `olius_backup_same_server`, porta 55488,
reutilizando os papéis da origem. Ambos os cenários passaram.

## Resultados observados

| Verificação | Resultado |
| --- | --- |
| Servidor e cliente | PostgreSQL / pg_dump 16.15 |
| Admin na origem e no destino | `recovery_admin`, SUPERUSER=false, CREATEDB=true, CREATEROLE=true |
| Restauração sem CREATE temporário | Falha esperada; transação revertida, nenhuma tabela/view residual |
| Restauração corrigida em outro servidor | PASS |
| Restauração corrigida no mesmo servidor | PASS |
| Dados | Hashes iguais nos 75 conjuntos de tabelas/materializadas |
| Estrutura | Dump de schema normalizado igual: owners, ACLs, tipos, rotinas, SECURITY DEFINER, search_path, triggers, views, índices e constraints |
| Inventário | 233 rotinas no schema public (incluindo extensão), 90 triggers não internas, 3 views normais |
| Privilégios do próprio banco | ACLs iguais após reposição do CONNECT oficial |
| Conexão real `olius_core_api` | INSERT em users permitido; exatamente um registro de auditoria produzido |
| Rotina de autenticação | `open_auth_session` retornou `OK` pela conexão real da Core |
| DDL pela Core | CREATE TABLE negado |
| CREATE em public após limpeza | false para olius_auth_owner e olius_business_owner |
| Encerramento das duas instâncias | Concluído sem erro |

Hash SHA256 do schema normalizado, igual na origem e nos dois destinos:

```text
257591cc9bdddb289e5202b0bc53379e5206750078631414a87f20ea13d738d4
```

A comparação ignora apenas comentários/chaves aleatórias `\restrict`, ordena
os GRANT/REVOKE para não confundir ordem de ACL com diferença de privilégios
e normaliza a grafia conhecida do AND associativo da constraint
`ck_subscription_cycle_anchor`. Não remove parênteses de expressões em geral.
Os conteúdos de todas as linhas são ordenados e comparados por hash, incluindo
logs. Os hashes dos conjuntos estão em `validation_evidence.json`.

Os comandos completos, SQL enviado, saídas e códigos de retorno da execução
estão em `artifacts/commands.log`; os dumps e inventários brutos também ficam
em `artifacts/` e são ignorados pelo Git. `validation_evidence.json` preserva
o resultado efetivo e os inventários sem publicar dumps ou credenciais.

## Limites

Esta evidência cobre a versão do OLIUS desta branch, dados sintéticos, papéis
globais do contrato oficial e extensões instaladas na máquina local. Não prova
conectividade, TLS, quotas ou restrições específicas de um serviço Aiven.
Contas/ACLs customizadas, extensões adicionais e proprietários diferentes
exigem inventário e preparação específicos. O script final repõe o CONNECT
oficial; ACLs adicionais/revogação de PUBLIC no banco devem ser replicadas
conforme o inventário aprovado da origem.

O formato lógico recompõe materializadas por REFRESH: snapshots desatualizados
da origem não são copiados literalmente. O laboratório atualiza-os antes do
dump. Não foram executadas requisições HTTP à Core; a operação foi feita pela
identidade PostgreSQL real `olius_core_api`, como solicitado.

CI/Sonar anteriores não validavam esse procedimento. A execução de 30/10
acima foi local, ainda sem instrumentação de cobertura ou integração ao CI.

## Atualização de 31/10/2026 — cobertura Python e CI

O workflow agora executa a recuperação real antes do Sonar, na imagem
`Dockerfile.validation` com PostgreSQL 16.15 e Coverage.py 7.10.7. O checkout
é montado somente para leitura, o usuário Linux é `postgres`, não há portas
publicadas e o container roda com `--network none`. Os relatórios ficam fora
do checkout somente para leitura por meio da opção `--report-dir` do runner.

Foram executados novamente os cenários completos no Windows e no container
Linux usado pela etapa do CI. Ambos terminaram com código zero e PASS,
incluindo a restauração como administrador sem SUPERUSER, comparação dos
75 conjuntos, operação pela Core, controle negativo e revogação dos privilégios.

Cobertura medida em ambos: **126 de 142 linhas executáveis (88,73%)**, exibida
como 89% por `coverage report`. O mínimo exigido pela etapa é 80%.
O relatório XML Linux foi gerado em `coverage/backup-recovery/python.xml`.
A `.coveragerc` usa caminhos relativos; o XML aponta para a origem
`PostgreSQL/backup_recovery` e o arquivo `validate_recovery.py`.
`sonar.python.coverage.reportPaths` inclui esse relatório junto dos anteriores.

A validação local reproduziu os comandos da nova etapa Docker, incluindo
geração do XML e limite de cobertura. Isso não equivale a uma execução remota
do GitHub Actions nem confirma aprovação do Quality Gate após o push.
Os comandos para reproduzir a medição estão em `PostgreSQL/tests/README.md`.
