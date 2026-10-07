# Conexão, preparação e execução

## Ambiente adotado

O caminho implementado é Python/PySpark com leitura JDBC em **compute clássico
dedicado**, com acesso ao PostgreSQL. Referência: Databricks Runtime 15.4 LTS
ou superior, Unity Catalog e um catálogo com permissão de escrita.
Instalar psycopg[binary] como biblioteca Python e disponibilizar o driver
JDBC PostgreSQL org.postgresql.Driver. Escolher versões aprovadas pelo ambiente.

Não assumimos que Free Edition, ambiente acadêmico ou serverless permita esse
caminho de instalação/rede. Se o ambiente oferecer apenas serverless, avaliar
conector nativo ou conexão JDBC do Unity Catalog e adaptar a leitura. O script
atual também precisa de psycopg/rede no driver para refresh e lock.

Documentação oficial:
- [Tarefas Python e bibliotecas](https://docs.databricks.com/aws/en/jobs/tasks/python-script).
- [Conectores, driver JDBC e restrições de compute](https://docs.databricks.com/aws/en/connect/spark-data-sources).
- [Execução de arquivos SQL](https://docs.databricks.com/aws/en/jobs/sql).

## 1. PostgreSQL

Instalar 07_materialized_views.sql com o papel proprietário das views.
O procedimento SECURITY DEFINER executa com as permissões do proprietário;
ele só atualiza os objetos fixos de dm, não recebe nomes ou SQL arbitrário.
EXECUTE é revogado de PUBLIC.

Criar dois papéis de login no provedor, com credenciais fora do Git:
- olius_bi_reader: leitura das views via JDBC.
- olius_bi_refresh: leitura e execução do procedimento, sem editar a aplicação.

Exemplo de permissões, após criar os papéis, substituindo NOME_DO_BANCO:

```sql
GRANT CONNECT ON DATABASE NOME_DO_BANCO TO olius_bi_reader, olius_bi_refresh;
GRANT USAGE ON SCHEMA dm TO olius_bi_reader, olius_bi_refresh;
GRANT SELECT ON ALL TABLES IN SCHEMA dm TO olius_bi_reader, olius_bi_refresh;
GRANT EXECUTE ON PROCEDURE dm.refresh_data_mart() TO olius_bi_refresh;
```

Não conceder CREATE em dm, propriedade das views ou edição das tabelas public
a esses logins. Novos objetos de dm exigem revisar os grants.

Liberar acesso de rede **do compute do Databricks**, não somente do computador
do desenvolvedor. Conforme o provedor, usar regras de saída/entrada, endpoint
privado e roteamento ou lista de IPs. Driver e executores Spark precisam alcançar
o host e porta do banco. Evitar endpoint de pool transacional: o controlador
usa advisory lock de sessão, portanto precisa de endpoint direto ou pool de
sessão com semântica compatível.

## 2. Secrets e TLS

Criar secret scope, por exemplo postgres-bi, com quatro chaves:

| Chave | Conteúdo |
| --- | --- |
| read-user | Login de leitura |
| read-password | Senha de leitura |
| refresh-user | Login autorizado a chamar o refresh |
| refresh-password | Senha de refresh |

Permitir leitura desses secrets somente à identidade de execução do Job e
aos administradores necessários. Não passar senhas em argumentos nem URLs.

TLS usa verify-full para validar servidor e hostname. Se a cadeia CA não
estiver disponível nos trust stores, fornecer --pg-sslrootcert com arquivo
acessível ao driver Python e --jdbc-sslrootcert com arquivo acessível a cada
executor JDBC. Esses caminhos podem ser diferentes. Conferir a cadeia exigida
pelo provedor; não desativar a validação para contornar problemas de conexão.

## 3. Instalação no Databricks

Importar os arquivos no Workspace ou conectar o repositório Git.
No SQL editor, definir o parâmetro nomeado catalog com um catálogo existente.
Executar 01_structure.sql e depois 03_views.sql. Usar o mesmo catálogo em todos
os arquivos e no argumento Python. Os schemas fixos são olius_bi_landing
(armazenamento técnico) e olius_bi (consumo).

Não executar os SQLs do PostgreSQL no Databricks ou vice-versa. CREATE MATERIALIZED
VIEW/REFRESH e permissões são específicos da origem; USING DELTA e IDENTIFIER
são específicos do destino.

## 4. Job de ingestão

Criar um Job com tarefa Python script apontando para Databricks/02_ingestion.py.
Se usar Git provider, esse é o caminho relativo no repositório. Selecionar
compute com as dependências e configurar estes argumentos como lista:

```text
--catalog SEU_CATALOGO
--pg-host SEU_HOST_POSTGRESQL
--pg-port 5432
--pg-database SEU_BANCO
--secret-scope postgres-bi
--query-timeout 600
```

Host/banco são exemplos a substituir, sem senha. O script aceita nomes de
banco e catálogo formados por letras, números e underscore; para identificadores
com hífen será necessário adaptar a validação/quoting. Configurar certificados
com os argumentos TLS quando necessário.

Configurar uma execução concorrente no máximo, intervalo maior que o tempo
normal de carga, timeout do Job compatível e tentativas limitadas em caso de
falha. Para começar, executar manualmente com Run now antes de agendar.

A tarefa faz refresh, leitura, validação e publicação. Não exige uma pipeline
adicional. Configurar alertas de falha/atraso no ambiente. Depois de um primeiro
lote bem-sucedido, executar 04_quality_checks.sql e conferir as três views de
dashboard. A seguir configurar atualização dos datasets do dashboard após
o Job; a frequência e cache do dashboard são separados da ingestão.

## 5. Permissões no destino

A identidade do Job precisa de uso do catálogo/schema, leitura do destino e
MODIFY nas tabelas landing. O instalador precisa criar schemas/tabelas/views.
Usuários dos dashboards recebem acesso ao catálogo/schema e às views necessárias
em olius_bi; não precisam de secrets, JDBC ou edição das tabelas landing.
Verificar no workspace como o proprietário da view acessa suas dependências.

## Problemas frequentes

| Sintoma | Conferir |
| --- | --- |
| Timeout de conexão | Endpoint, porta, firewall e saída de rede do compute |
| Erro TLS | CA, hostname do certificado e caminhos em driver/executores |
| Driver JDBC ausente | Biblioteca PostgreSQL no compute |
| Import psycopg falha | Biblioteca Python no ambiente da tarefa |
| Permissão negada | Secrets, grants na origem e privilégios Unity Catalog |
| Lock ocupado | Outro refresh/ingestão; esperar término e repetir |
| Tipos incompatíveis | Schema de origem/destino e versões do driver; não forçar cast silencioso |
| Dashboard vazio | Instalação feita, mas nenhum lote foi publicado; olhar logs |

Ainda é necessário homologar no workspace e banco reais: os arquivos não
instalam bibliotecas nem configuram infraestrutura por conta própria.
