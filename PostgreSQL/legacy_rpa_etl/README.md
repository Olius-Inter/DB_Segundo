# OLIUS — Migração B2C do legado por Airflow/Python

## Natureza acadêmica dos dados

Em 05/11/2026, a equipe esclareceu que os cadastros do banco legado também são
simulados. Os CSVs originais de complementação foram preenchidos com dados
sintéticos autorizados, preservando os IDs da origem, para demonstrar a migração.
A pasta Demonstracao_Ficticia contém exemplos anteriores e não é a entrada usada.
Validar formato, vínculos, duplicações e falhas continua parte do exercício; essa
autorização não equivale a verificação de identidade ou posse de e-mail em produção.
Não alterar documentos inválidos da origem silenciosamente: rejeitá-los e demonstrar
o tratamento de falhas. Senhas, hashes e chaves continuam fora de logs/Git.
Escrita exige alvo de demonstração identificado; não usar banco de aplicação ativo
sem autorização específica. Carga no legado permanece proibida.

## Escopo aprovado

Importar somente cadastros B2C válidos: users, telephone, user_qr_code e citizens.
Preservar os hashes PBKDF2 legados para a Core convertê-los em Argon2id após login
válido. Importar ACTIVE, sem pontos históricos, sem criação de sessões. Os timestamps
no destino refletem a importação. A data original fica em olius_etl.citizen_import.
ADM, PEV, coleta, entrega, carteira, pontos e certificados não são importados.
B2Bs e motoristas têm carga complementar opt-in documentada em EXTENDED_LOAD.md;
sem os complementos/flag, continuam somente no staging/histórico.

## Fluxo e arquivos

Airflow → extração consistente READ ONLY/REPEATABLE READ → SQLite original +
credenciais criptografadas → preparo B2C → carga opt-in → reconciliação.

| Arquivo | Responsabilidade |
|---|---|
| pipeline.py | Extração, preparo, resultados agregados e CLI |
| credentials.py | Validação exata do PBKDF2 e transporte Fernet vinculado a lote/titular |
| loader.py | Carga por cidadão, conflitos e reconciliação |
| connections.py | Conexão TLS explícita com confirmação do destino |
| 01_destination_control.sql | Instalação única da proveniência técnica no destino |
| airflow/ | DAG, ambiente local, Compose de carga opcional e testes de importação |
| integration_check.py | Teste completo exclusivamente em PostgreSQL descartável |

## Credenciais e proteção

As consultas originais excluem senha. Outra consulta lê somente hashes de usuários
B2C ligados à especialização. ADM e outros perfis não têm credenciais transportadas.
Somente o formato pbkdf2$120000$salt$hash canônico aceito pela Core é selado.
Hash inválido/ausente vai para rejeição no preparo; lotes antigos sem extração
protegida continuam bloqueados e exigem uma nova extração.

O hash é criptografado com Fernet antes de persistir no SQLite, separado do JSON de
cadastro. A chave é exclusiva do ETL, diferente da chave interna do Airflow, e deve
ficar em arquivo restrito fora do repositório/staging. A cifra carrega vínculo com
lote e ID de origem: não pode ser trocada entre titulares. TLS verify-full protege
as conexões reais. Passfiles temporários no Linux têm modo 0600. O hash é aberto
somente em memória para a carga. Python não garante apagar todas as cópias da
memória; não tratar isso como proteção contra comprometimento do processo.

Não emitir senhas, hashes, payloads, documentos, chaves ou ciphertext em logs/XCom.
Os demais dados pessoais do staging não são criptografados por este módulo:
proteger o volume e seus backups, restringir acesso e definir retenção antes de
uso recorrente. Após aceite final, aplicar descarte controlado; não apagar chaves
antes de encerrar retomadas que dependam dos lotes. Nenhum comando de limpeza é
automático nesta entrega.

## Destino e transações

Instalar 01_destination_control.sql uma única vez, por administrador autorizado,
após os scripts oficiais e o controle de acesso. A segunda execução dá erro de
tabela existente e exige ROLLBACK; não é uma migração reaplicável. O schema técnico
não modifica as tabelas de negócio. Não armazena senha/hash/CPF na proveniência.

Executar a carga com conta de manutenção autorizada que já possua olius_owner,
em janela controlada. Não utilizar a conta Core nem ampliar suas permissões. O
papel possui poderes amplos: este carregador é ferramenta de migração administrada,
não um endpoint público nem serviço permanente. Não cria usuários, roles ou grants
em objetos de negócio. Para operação recorrente com conta de privilégios mínimos,
será necessária uma entrega específica de controle de acesso antes da produção.

Uma transação por cidadão confirma usuário, telefone, QR, citizens e mapeamento
origem→UUID. Triggers/constraints ficam ativas. Auditoria SYSTEM com motivo e lote,
sem autor fictício. Falha desfaz inclusive os logs dessa unidade; cidadãos já
confirmados não são desfeitos por falha posterior de outro cidadão.

Reenvio com mesma origem/ID/fingerprint retorna ALREADY_IMPORTED, sem atualizar o
usuário. Assim um hash já atualizado pela Core e edições do app são preservados.
Mudança do payload ou hash de origem gera CONFLICT. CPF/e-mail existente não é
mesclado por aproximação. Unicidade e bloqueio transacional serializam reenvios.
Uma colisão simultânea por outra identidade pode gerar erro de integridade e
interromper a tarefa; nunca é resolvida com sobrescrita automática.

Se o processo cair após COMMIT e antes de registrar o resultado SQLite, repetir a
carga consulta o mapeamento no PostgreSQL e reconhece a unidade confirmada. Os
resultados locais são vinculados ao destino para impedir reutilizar o lote com
outro banco. A reconciliação confere todas as unidades READY, a proveniência e os
vínculos de usuário/cidadão/QR; conflitos pendentes fazem a reconciliação falhar.
Não compara o hash atual ao antigo, pois o login pode tê-lo atualizado legitimamente.

## Execução

Preferir a DAG descrita em airflow/README.md. O default continua somente preparo:
OLIUS_ETL_LOAD_ENABLED=false. O carregador exige destino configurado separadamente,
confirmação literal host:porta/banco e TLS. Nunca aponta por padrão para o legado.

CLI, após configurar OLIUS_LEGACY_HOST/PORT/DATABASE/USER/CA e pgpass local:

```powershell
python PostgreSQL/legacy_rpa_etl/pipeline.py extract --stage '<diretorio protegido>/stage.sqlite' --credential-key-file '<arquivo protegido de chave>'
python PostgreSQL/legacy_rpa_etl/pipeline.py prepare --stage '<diretorio protegido>/stage.sqlite' --run-id '<UUID>'
python PostgreSQL/legacy_rpa_etl/pipeline.py report --stage '<diretorio protegido>/stage.sqlite' --run-id '<UUID>'
```

Para load/reconcile, configurar OLIUS_TARGET_HOST/PORT/DATABASE/USER/CA/PGPASS,
OLIUS_ETL_CONFIRMED_TARGET e habilitação de carga. Somente execute contra alvo
explicitamente autorizado. O report mostra contagens, nunca credenciais. Status
de candidato READY significa elegível, não importado. IMPORTED/ALREADY_IMPORTED
são resultados do destino. destination_writes conta IMPORTED no último processamento
do lote, não um contador histórico cumulativo. Os candidatos rejeitados permanecem
separados, com motivos no SQLite. Não reexecutar prepare após tentativa de carga;
para retomar, repetir load/reconcile.

## Testes

```powershell
python -m unittest discover -s PostgreSQL/legacy_rpa_etl -p 'test_*.py' -v
$env:OLIUS_ETL_DISPOSABLE='1'
python PostgreSQL/legacy_rpa_etl/integration_check.py
```

O integrador cria seu próprio container rotulado PostgreSQL 16.15 e o remove ao
final. Não lê .env, Aiven ou bancos existentes. Testa instalação oficial, carga,
reenvio, concorrência, conflito, rollback com auditoria, preservação de edição/hash
no app, extração real READ ONLY contra fonte fictícia separada, cifra e reconciliação.
Os testes da DAG usam a imagem real do Airflow; não equivalem a uma execução da DAG
com scheduler e APIs reais. O CI agora executa testes e integração descartável, além dos testes da DAG em
imagem real, gerando relatórios de cobertura para o Sonar. A aprovação da esteira
ainda depende de execução remota; não é garantida por verificações locais.

## Preservação e bloqueios atuais

archive.py pode ser acionado pela DAG com OLIUS_ETL_ARCHIVE_ENABLED=true e o
complemento compose.archive.yaml. Ver HISTORY_ARCHIVE.md e airflow/README.md.
Nenhuma saída para OneDrive é produzida com a flag desabilitada.

A chave original do CPF foi validada em leitura separada; seu conteúdo não pertence
ao repositório. prepare aceita --cpf-key-file com arquivo Base64 de 32 bytes.
Sem arquivo, valores aesgcm recebem CPF_DECRYPTION_KEY_REQUIRED. Falha de autenticação,
formato de cifra ou chave incompatível produz CPF_DECRYPTION_FAILED. CPFs precisam
ter 11 dígitos e verificadores válidos; rejeições não são corrigidas automaticamente.
Duplicações são verificadas depois da descriptografia, não pelo ciphertext.
raw_rows mantém o valor original; candidates contém CPF textual somente quando
válido. Proteger o staging, que já contém outros dados pessoais, com acesso restrito
 e retenção controlada. Nenhum CPF/chave deve aparecer em logs ou XCom.

No Airflow, adicionar compose.cpf.yaml aos arquivos Compose usados normalmente e
definir OLIUS_LEGACY_CPF_KEY_HOST_FILE com o caminho local do arquivo, nunca com a
chave. O segredo é montado somente para leitura; não é obrigatório no Compose base.
Recriar o serviço para aplicar esse complemento fica a cargo do operador. Não
reiniciar nem habilitar carga real automaticamente. Lotes sem tentativa de carga
podem repetir prepare com a chave; após tentativa de carga, usar novo lote para
reavaliar documentos antes rejeitados, preservando a proveniência dos já importados.
A carga continua desabilitada por padrão. O arquivo
histórico preserva o valor original criptografado, sem depender dessa chave.
A carga cadastral B2B/motorista está implementada em extended.py, mas depende dos
complementos privados confirmados e de habilitação explícita. Fatos operacionais
coleta/entrega/certificado continuam sem carga, sem enfraquecer FKs.

## Scheduler real e regressão de parâmetros

A validação do scheduler está em airflow/tests/scheduler_check.py e documentada em
SCHEDULER_VALIDATION.md. Ela usa rede Docker interna, TLS e dados fictícios para
carga, reexecução, falha e retomada. Não depende de CPF_CHAVE nem do Aiven.
O CI repete a validação em job próprio. O ambiente pessoal do Airflow não foi
reiniciado. Sucesso desse teste não autoriza carga real nem resolve complementos
pendentes do legado.

## Complementação de B2Bs e motoristas

O validador local complements.py confere os CSVs privados sem importar registros.
O preparo/carga complementares estão em extended.py; ver EXTENDED_LOAD.md.
Ver COMPLEMENTS.md para comandos, limites e pendências de fechamento da sprint.

## Resultado da execução acadêmica no Aiven

Ver RESULTADO_DEMONSTRACAO.md para carga, reenvio, reconciliação, preservação
e limites observados em 05/11/2026. A execução manual dos módulos no Aiven
é distinta da validação do scheduler em ambiente descartável.
