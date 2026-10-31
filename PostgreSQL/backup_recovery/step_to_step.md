# Backup e recuperação do OLIUS — PostgreSQL 16.15

Este procedimento preserva estrutura, registros, proprietários, permissões,
triggers, rotinas e views. Recuperar SEMPRE em banco novo e vazio, com nome
diferente da origem. Não usar `--clean`, `--create`, `--no-owner` ou `--no-acl`.
`SECURITY DEFINER` depende da identidade e dos privilégios dos owners internos.

## Preparação comum ao banco local e à Aiven

Execute os exemplos no PowerShell, na raiz do repositório. Instale os clientes
16.15 (`pg_dump --version`, `psql --version`) e confira `SHOW server_version;`.
O usuário de origem precisa conseguir ler todas as tabelas exportadas.

O administrador de destino NÃO precisa de SUPERUSER. Precisa de LOGIN,
CONNECT, CREATEDB e propriedade do banco de recuperação. Para provisionar os
globais, precisa de CREATEROLE e ADMIN OPTION nos grupos que conceder.
Precisa poder SET ROLE e herdar os privilégios de TODOS os owners do dump,
inclusive `olius_owner`, `olius_auth_owner`, `olius_business_owner`,
`olius_dm_owner` e a conta original de implantação quando diferente.

### Mesmo servidor

Papéis e memberships são globais e já existem. Confira seus atributos e a
autoridade do administrador; não recrie usuários nem altere senhas.
Registre memberships antes da preparação:

```sql
SELECT g.rolname AS grupo, u.rolname AS membro, grantor.rolname AS concedente,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_auth_members m
JOIN pg_roles g ON g.oid=m.roleid
JOIN pg_roles u ON u.oid=m.member
JOIN pg_roles grantor ON grantor.oid=m.grantor
ORDER BY 1,2,3;
```

### Outro servidor

`pg_dump` NÃO cria papéis, senhas ou memberships globais. Antes de restaurar,
crie apenas os papéis necessários com os MESMOS nomes/atributos da origem.
O script `provision_roles.sql` cria os grupos OLIUS ausentes e verifica os
existentes. Os grupos internos são NOLOGIN, NOSUPERUSER, sem poderes globais;
os grupos do Data Mart usam NOINHERIT. Contas incompatíveis interrompem o
script para revisão, sem mudança automática de atributos ou senhas.

```powershell
psql -X --dbname="$DestinoAdmin" -W --set=ON_ERROR_STOP=on --file="PostgreSQL/backup_recovery/provision_roles.sql"
if ($LASTEXITCODE -ne 0) { throw "Falha na preparação global" }
```

Defina `$DestinoAdmin` conforme a seção local/nuvem abaixo antes de executar.
O script pode também verificar o mesmo servidor. Ele concede ao administrador
memberships ausentes com SET e INHERIT; registre os NOTICEs e compare
o inventário antes/depois. Após a validação, revogue SOMENTE as memberships
novas autorizadas como temporárias: `REVOKE grupo FROM administrador;`.
Não revogar memberships preexistentes nem remover roles donas dos objetos.

Revise o dump para outros owners e beneficiários de ACLs. Se a conta da origem
não existe no destino, provisione esse papel também e conceda SET/INHERIT ao
administrador autorizado. Se o dump tem ACLs diretas a usuários, seus papéis
também precisam existir ANTES dos objetos. Não usar `--no-owner` para contornar
isso: remapear proprietários exige revisão específica e nova validação.
Em servidor autogerenciado, `pg_dumpall --roles-only --no-role-passwords`
auxilia o inventário; não reaplicar cegamente globais de outros projetos ou
papéis reservados da Aiven. Configure credenciais fora do SQL/Git.

NÃO executar `access_control/01_roles.sql` antes dos objetos: ele depende das
tabelas, tipos, catálogo, rotinas e views. O dump já restaura ownership/ACLs.
Após recuperar, `access_control/02_users.sql` pode provisionar as contas e
memberships do projeto; revisar colisões e configurar senhas fora do Git.
Nunca atribuir owners internos à conta da Core API.

## Banco local

Use nomes simples de banco (letras, números e underscore). Separe claramente
origem, conexão administrativa e banco de recuperação:

```powershell
$BancoOrigem = "meu_banco"
$BancoRecuperacao = "olius_recuperado"
if ($BancoOrigem -eq $BancoRecuperacao) { throw "Use nomes diferentes" }
$Origem = "host=localhost port=5432 user=administrador dbname=$BancoOrigem"
$DestinoAdmin = "host=localhost port=5432 user=administrador dbname=postgres"
$Destino = "host=localhost port=5432 user=administrador dbname=$BancoRecuperacao"

pg_dump --dbname="$Origem" -W --format=plain --file="backup_local.sql"
if ($LASTEXITCODE -ne 0) { throw "Backup falhou" }
psql -X --dbname="$DestinoAdmin" -W --set=ON_ERROR_STOP=on -c "CREATE DATABASE $BancoRecuperacao WITH TEMPLATE template0;"
if ($LASTEXITCODE -ne 0) { throw "Criação falhou; não prosseguir" }
# Prepare/verifique os papéis conforme a seção anterior.
psql -X --dbname="$Destino" -W --set=ON_ERROR_STOP=on --set="source_database=$BancoOrigem" --single-transaction --file="PostgreSQL/backup_recovery/prepare_restore.sql" --file="backup_local.sql" --file="PostgreSQL/backup_recovery/finish_restore.sql"
if ($LASTEXITCODE -ne 0) { throw "Recuperação revertida; investigar o erro" }
```

## Banco em nuvem — Aiven

Use o endpoint direto PostgreSQL e os dados do painel (incluindo a porta).
Confira acesso de rede/IP e permissões da conta. Mesmo serviço = mesmos
papéis globais; outro serviço = preparar os globais no destino.
Todos os pré-requisitos de papéis e privilégios acima também se aplicam aqui.

```powershell
$BancoOrigem = "db_segundo_olius"
$BancoRecuperacao = "olius_recuperado"
if ($BancoOrigem -eq $BancoRecuperacao) { throw "Use nomes diferentes" }
$Origem = "host=HOST_ORIGEM port=PORTA_ORIGEM user=avnadmin dbname=$BancoOrigem sslmode=require"
$DestinoAdmin = "host=HOST_DESTINO port=PORTA_DESTINO user=avnadmin dbname=defaultdb sslmode=require"
$Destino = "host=HOST_DESTINO port=PORTA_DESTINO user=avnadmin dbname=$BancoRecuperacao sslmode=require"

pg_dump --dbname="$Origem" -W --format=plain --file="backup_aiven.sql"
if ($LASTEXITCODE -ne 0) { throw "Backup falhou" }
psql -X --dbname="$DestinoAdmin" -W --set=ON_ERROR_STOP=on -c "CREATE DATABASE $BancoRecuperacao WITH TEMPLATE template0;"
if ($LASTEXITCODE -ne 0) { throw "Criação falhou; não prosseguir" }
# Prepare/verifique os papéis conforme a seção inicial.
psql -X --dbname="$Destino" -W --set=ON_ERROR_STOP=on --set="source_database=$BancoOrigem" --single-transaction --file="PostgreSQL/backup_recovery/prepare_restore.sql" --file="backup_aiven.sql" --file="PostgreSQL/backup_recovery/finish_restore.sql"
if ($LASTEXITCODE -ne 0) { throw "Recuperação revertida; investigar o erro" }
```

`sslmode=require` criptografa. Para verificar também certificado/hostname, use
`sslmode=verify-full sslrootcert=CAMINHO_CA` com a CA do serviço.
Não versionar senhas ou dumps contendo dados reais.

## Privilégios temporários e reversão

`ALTER ... OWNER` exige SET ROLE e CREATE no schema para o novo proprietário.
Os owners `olius_auth_owner` e `olius_business_owner` normalmente não têm
CREATE. `prepare_restore.sql` concede CREATE em public aos owners necessários;
para transferir o schema dm, concede CREATE no banco a `olius_dm_owner`.
`olius_owner` mantém CREATE permanente conforme a política oficial.

`finish_restore.sql` revoga os privilégios temporários registrados pela
preparação. Os três arquivos rodam NA MESMA sessão/transação, com
ON_ERROR_STOP e --single-transaction; erro reverte objetos e concessões locais.
Não executar preparação e limpeza isoladamente. A criação do banco e as
memberships GLOBAIS são anteriores: não são desfeitas por essa transação.
Revise e remova memberships temporárias também quando a recuperação falhar.

```sql
SELECT rolname, has_schema_privilege(rolname,'public','CREATE') AS pode_criar
FROM pg_roles
WHERE rolname IN ('olius_auth_owner','olius_business_owner');
-- Devem continuar false quando assim estavam antes da preparação.
```

## Laboratório descartável e evidências

O runner exige PostgreSQL 16.15 completo (initdb, pg_ctl, psql, pg_dump) e
Python 3, sem bibliotecas extras. Usa SOMENTE 127.0.0.1, dois clusters novos
em diretórios temporários e portas 55486/55487; altere --port se necessário.
Encerra ambos ao terminar; não apaga diretórios/bancos existentes. Nunca usar
Aiven/produção para esta validação.

```powershell
python PostgreSQL/backup_recovery/validate_recovery.py --pg-bin "C:\Program Files\PostgreSQL\16\bin"
```

O superusuário apenas cria o administrador do laboratório. Instalação, dump e
restauração usam `recovery_admin NOSUPERUSER CREATEDB CREATEROLE`. A Core
conecta realmente como `olius_core_api`. Trust existe apenas nesse laboratório
local descartável; não copiar essa configuração para ambientes compartilhados.

Atualize as views materializadas da origem com a rotina oficial antes do backup se precisar comparar seus conteúdos: pg_dump as recompõe por REFRESH no destino, em vez de copiar snapshots antigos. O laboratório faz isso antes da exportação.

Critérios: reproduzir a falha sem CREATE temporário; recuperação corrigida
com saída zero; comparar hashes de TODOS os registros e schema completo
(owners, ACLs, triggers, constraints, índices, rotinas, views/materializadas,
SECURITY DEFINER e search_path); INSERT pela Core com auditoria; DDL negado
à Core; revogação de CREATE dos owners internos. Não basta contar linhas.

`artifacts/commands.log` registra comandos e saídas; `results.json` registra
resultados e os inventários/dumps ficam na mesma pasta. Os artefatos sintéticos
são ignorados pelo Git. Atualizar o relatório de validação a cada mudança.
CI/Sonar não comprovam recuperação sem executar o procedimento de recuperação.

## Referências

- [pg_dump 16](https://www.postgresql.org/docs/16/app-pgdump.html)
- [Privilégios e ownership](https://www.postgresql.org/docs/16/ddl-priv.html)
- [Backup na Aiven](https://aiven.io/docs/products/postgresql/howto/create-manual-backups)

O finish_restore.sql também repõe o CONNECT dos grupos oficiais no banco de destino: sem --create, o dump não carrega a ACL do próprio banco. Inventarie separadamente permissões customizadas e restrições de PUBLIC. Consulte [o relatório da execução real](validation_report.md) e [as evidências](validation_evidence.json).
