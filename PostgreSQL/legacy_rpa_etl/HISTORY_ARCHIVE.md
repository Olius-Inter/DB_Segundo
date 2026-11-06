# Preservação histórica do legado

Módulo: `archive.py`. Não consulta PostgreSQL nem depende da chave `CPF_CHAVE`.
Lê um staging PREPARED, gera JSON somente em memória e o criptografa com Fernet
antes de gravar. Exclui campos estruturados de senha, hashes de senha, tokens e
chaves; não acessa sealed_credentials. Não produz um backup completo do legado.

## Saídas e organização aprovada

- Histórico criptografado: pasta OneDrive `03_Olius - Histórico Legado Protegido/01_Arquivos_Criptografados`.
- Backup criptografado: `C:/Users/pedrobarbeitos-ieg/OLIUS_Privado/HistoricoLegado/01_Backup_Criptografado`.
- Chave exclusiva de histórico: arquivo em `OLIUS_Privado/HistoricoLegado/02_Chaves`, fora da nuvem/Git.
- Relatório público agregado: `02_Olius - Histórico Legado/02_Relatorios`.

Verificar primeiro que o histórico protegido no OneDrive é acessível somente a
Pedro e Caio. O programa não configura compartilhamentos/ACLs Windows. O nome
da pasta não concede confidencialidade. Recuperação da chave pelo Caio continua
pendente; não afirmar recuperação independente até configurar e testar essa cópia.

O arquivo tem nome por UUID de lote e versão. O manifesto indica SHA-256 do arquivo
criptografado e o resultado do teste de abertura da cópia local. O relatório público
contém apenas contagens por tabela, lote e situação de retenção, sem registros,
IDs dos titulares, documentos, e-mails, host da origem ou credenciais.

A cópia local é comparada e aberta em memória para testar a recuperação. Isso não
comprova que o OneDrive concluiu a sincronização: conferir esse estado na nuvem.
O programa não apaga arquivos nem oferece descarte automático nesta etapa.

## Conteúdo

Preservar registros não importados ou sem mapeamento operacional aprovado. Cidadãos
já confirmados no destino ficam fora do arquivo, salvo a referência de endereço
pessoal que não possui equivalente no modelo atual. Essa referência é preservada
sem duplicar o perfil já importado. Endereços legados continuam no arquivo.

CPFs com prefixo aesgcm permanecem exatamente criptografados como estavam na origem:
a conversão na preparação exige a chave original, armazenada separadamente. Preservar o ciphertext não soluciona a
perda dessa chave. Ausência dela não impede arquivar o histórico externo cifrado.

Não gerar pontos/certificados nem registrar esses fatos como operações válidas na
API. O estágio de consulta do grupo recebe somente relatório agregado nesta entrega;
não foi criado um export de linhas individuais supostamente anônimas. Pequenos
conjuntos podem permitir inferências por quem conhece a origem; revisar a distribuição.

## Chave e execução manual

Usar uma chave Fernet exclusiva para histórico, diferente da chave de transporte
temporário de senhas e da chave interna do Airflow. Gerar uma vez e guardar em
arquivo com acesso restrito; nunca regenerar para abrir um arquivo antigo. Nenhuma
chave real é gerada pelo exportador. Não executar com o Airflow/carga modificando
o mesmo lote simultaneamente. O CLI abre SQLite em modo somente leitura.

```powershell
python PostgreSQL/legacy_rpa_etl/archive.py --stage '<staging local>' --run-id '<UUID>' --key-file '<chave exclusiva de historico>' --encrypted-dir '<pasta protegida>/01_Arquivos_Criptografados' --backup-dir 'C:/Users/pedrobarbeitos-ieg/OLIUS_Privado/HistoricoLegado/01_Backup_Criptografado' --report-dir '<pasta compartilhada>/02_Relatorios' --version 1
```

Os diretórios das três saídas devem ser separados, sem conter uns aos outros.
A chave não pode estar dentro deles. O staging é entrada local e não deve ser
copiado para a pasta compartilhada. O relatório não substitui o controle de acesso.

Reexecução da mesma versão reutiliza o arquivo se o conteúdo lógico for idêntico,
conferindo novamente a cópia. Conteúdo diferente ou backup corrompido não é sobrescrito:
falha exige revisão e eventual nova versão. Falha durante escrita pode deixar arquivo
parcial criptografado; não se emite relatório de sucesso sem conferir ambas as cópias.
Não apagar evidência automaticamente. Validar a falha e remover/quarentenar o arquivo
parcial mediante ação autorizada antes de repetir essa versão.

## Retenção

`--evaluation-date YYYY-MM-DD` registra a avaliação final e calcula +90 dias.
Sem essa data, o prazo é PENDENTE, não retenção ilimitada aprovada. Incluir a data
posteriormente muda o manifesto/conteúdo: gerar versão revisada, sem sobrescrever a
anterior, e garantir que a política de descarte alcance todas as versões/backups.
Revisar lixeira/versionamento e políticas institucionais da nuvem ao eliminar.

## Estado de integração

O exportador pode ser chamado manualmente ou pela tarefa archive_history da DAG,
com habilitação explícita e compose.archive.yaml. A tarefa aguarda o término das
etapas de carga/reconciliação, mesmo se forem ignoradas ou falharem. Não altera o
resultado de falha da carga. Exige lote preparado; sem esse lote é ignorada. A exportação real, sincronização,
teste com o Caio e aceite final permanecem pendentes. Não foram gerados arquivos de
histórico do Aiven nem escritas nas pastas compartilhadas nos testes.

A tarefa final workflow_finished impede que o histórico executado com all_done
mascare uma falha na carga ou na reconciliação. Nenhum componente envia a chave
ao OneDrive ou ao relatório compartilhado.

Cadastros B2B e MOTORISTA importados por extended.py continuam no histórico original,
com motivo CADASTRO_IMPORTED_WITH_UNMAPPED_LEGACY_FIELDS, para preservar campos sem
destino (por exemplo Plano e empresa_resp). Isso não atribui contratos ou operações.

### Confirmação e publicação

A exclusão do perfil B2C do histórico depende de reconciliação durável com o
mesmo destino vinculado ao lote. Checkpoint IMPORTED isolado não basta; em falha,
os dados originais continuam preservados. B2B/motoristas mantêm dados não mapeados.
Staging e chaves não podem estar dentro das pastas de saída, especialmente a
compartilhada. Para Airflow, execute `python start.py --archive` (demais flags
conforme o escopo) na pasta airflow: o iniciador valida a separação real no host.
Arquivos são escritos e sincronizados em temporário no mesmo diretório e só
então publicados atomicamente, sem sobrescrever versão existente. Interrupção
não deixa um relatório final parcial; temporários não constituem evidência de
conclusão. Mudança de conteúdo exige nova versão revisada.
