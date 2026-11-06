# Complementação de cadastros e critérios de fechamento

## Arquivos de entrada privados

B2B.csv e MOTORISTAS.csv são formulários preenchidos pelos responsáveis pela
migração. Não são saídas do RPA nem substituem o histórico criptografado. Não
versionar arquivos preenchidos. Os modelos locais ficam em
C:/Users/pedrobarbeitos-ieg/OLIUS_Privado/HistoricoLegado/03_Complementacao_Cadastral.

O validador complements.py aceita CSV UTF-8 (com ou sem BOM), separado por ponto e
vírgula, com cabeçalhos exatamente iguais aos modelos. CPF/CNH são texto, mantendo
zeros iniciais. Não imprime linhas, IDs, documentos, nomes de revisores ou e-mails.
Só retorna contagens, motivos e situação. Não abre conexão nem escreve em banco.

```powershell
python PostgreSQL/legacy_rpa_etl/complements.py --kind b2b --file '<pasta privada>/B2B.csv'
python PostgreSQL/legacy_rpa_etl/complements.py --kind driver --file '<pasta privada>/MOTORISTAS.csv'
```

Valida campos obrigatórios, IDs originais numéricos, duplicações, situação
ACTIVE/INACTIVE, identificação do conferente e data não futura de confirmação.
Para B2B, verifica formato básico/unicidade do e-mail e categoria oficial. Não
comprova que a caixa postal existe ou pertence ao estabelecimento.
Para motorista, verifica CPF com dígitos verificadores, CNH com 11 dígitos e
unicidade dos documentos no arquivo. Não verifica autenticidade/validade da CNH.
Disponível/Ocupado não é interpretado como situação de cadastro.

Arquivo vazio retorna EMPTY e código de saída 1; registros inválidos retornam
REVIEW_REQUIRED e código 1; campos válidos retornam FIELDS_VALID e código 0.
Falhas de estrutura/leitura retornam FAILED sem conteúdo sensível.
FIELDS_VALID não significa cadastro autorizado ou pronto para carga: o CLI não
confere os IDs com a extração, colisões no destino ou vínculos de negócio.
validate_file aceita source_ids de um snapshot confiável para conferência em memória;
extended.py utiliza esse vínculo contra o snapshot para preparação complementar,
inclusive na DAG com compose.extended.yaml. FIELDS_VALID sozinho continua sem
autorizar carga. Ver EXTENDED_LOAD.md para o contrato de primeira senha e carga.

## Pendências para encerramento da sprint ampliada

| Item | Situação / condição de aceite |
|---|---|
| Extração e carga B2C | Implementadas; validar execução autorizada no destino real |
| CPF AES-GCM | Integrado por arquivo privado; 5 dos 6 documentos consultados precisam conferência dos verificadores |
| Complementos B2B/motoristas | Originais preenchidos com complementos simulados autorizados em 05/11/2026; validar contra o snapshot |
| Primeira senha B2B | Contrato aprovado: hash inicial aleatório e recuperação pela Core para ACTIVE; ver EXTENDED_LOAD.md |
| Carga ampliada | Preparação e loaders cadastrais implementados; complementos simulados preenchidos; validar execução em alvo de demonstração autorizado |
| Fatos históricos | Não inventar horários, ciclos, qualidade, PEV ou pontuação; manter no histórico quando não migráveis |
| Histórico real | Executar exportação autorizada e testar recuperação; verificar compartilhamento e sincronização OneDrive |
| Recuperação independente | Confirmar cópia protegida da chave e teste com Caio |
| Retenção | Informar data da avaliação final; aplicar prazo aprovado de 90 dias e descarte revisado |
| Aceite acadêmico | Confirmar que a orquestração por Airflow atende à integração RPA exigida |
| CI/Sonar | Verificar execução remota; testes locais não garantem aprovação |

Nenhum CSV preenchido, chave, CPF ou hash deve entrar no GitHub. Esta lista separa
implementação técnica de aceite operacional; sucesso da DAG com carga desabilitada
não comprova migração concluída.
