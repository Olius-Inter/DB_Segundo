# OLIUS — Migração B2C do legado por Airflow/Python

## Escopo aprovado

Importar somente cadastros B2C válidos: users, telephone, user_qr_code e citizens.
Preservar os hashes PBKDF2 legados para a Core convertê-los em Argon2id após login
válido. Importar ACTIVE, sem pontos históricos, sem criação de sessões. Os timestamps
no destino refletem a importação. A data original fica em olius_etl.citizen_import.
Não importar automaticamente ADM, B2B, PEV, motorista, coleta, entrega, carteira,
movimentação de pontos ou certificado. Esses dados permanecem apenas na preparação.

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
com scheduler e APIs reais. Integração CI/Sonar desta nova pasta ainda deve ser
fechada antes de considerar a branch pronta para PR.
