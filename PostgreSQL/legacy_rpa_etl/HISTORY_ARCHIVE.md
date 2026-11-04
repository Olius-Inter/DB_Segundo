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
sem CPF_CHAVE não podem ser convertidos. Preservar o ciphertext não soluciona a
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

O exportador é manual, testável sem bancos e sem dados reais. Não está conectado à
DAG: exportar apenas lote estabilizado e revisado. A exportação real, sincronização,
teste com o Caio e aceite final permanecem pendentes. Não foram gerados arquivos de
histórico do Aiven nem escritas nas pastas compartilhadas nos testes.
