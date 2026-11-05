# Carga complementar de estabelecimentos e motoristas

## Contrato aprovado

Importar cadastros B2B sem conta legada vinculada, combinando B2B + ENDERECO do mesmo
snapshot e o complemento confirmado por ID_B2B. B2B com ID_usuario preenchido fica
rejeitado para revisão de identidade/credencial, sem criação de conta duplicada.
Motoristas usam MOTORISTA do snapshot e o complemento confirmado por ID_motorista.
Não possuem login. Disponível/Ocupado no legado não determina ACTIVE/INACTIVE: usar
a situação expressamente confirmada no complemento.

O primeiro cadastro B2B gera hash Argon2id v19, m=19456, t=2, p=1, salt de 16 bytes,
saída de 32 bytes, a partir de segredo aleatório de 32 bytes. Nenhum prefixo fixo,
senha compartilhada ou credencial em CSV, staging, relatório ou proveniência.
A senha original não é entregue e não é persistida. Python não garante apagar
cópias temporárias em memória; proteger o processo e não capturar dumps/SQL params.
O hash permanece apenas no destino, no campo password_hash existente.

B2Bs ACTIVE definem sua senha pela recuperação já existente na Core, com o e-mail
previamente confirmado. A carga não envia e-mail, não cria token de recuperação e
não abre sessão. O responsável solicita a recuperação na aplicação; o envio e a
conclusão são responsabilidade da Core. INACTIVE não recupera senha até reativação
autorizada. Não existe estado específico de aguardando primeira senha nem marcador
inferido pelo hash. A proveniência identifica migração, não conclusão de recuperação.

## Instalação e preparação

Depois de estrutura, rotinas, triggers, controle de acesso e
01_destination_control.sql, instalar 02_extended_destination_control.sql UMA VEZ
no destino autorizado. Não é reaplicável; erro de tabela existente exige ROLLBACK.
Cria somente duas tabelas técnicas de proveniência, com FKs específicas para
establishment e driver, sob olius_owner. Não altera tabelas de negócio ou papéis.
Conta de manutenção já autorizada é a mesma da carga B2C; não usar a Core.

Após a preparação B2C do lote, executar com CSVs privados:

```powershell
python PostgreSQL/legacy_rpa_etl/extended.py prepare --stage '<staging privado>' --run-id '<UUID>' --kind b2b --file '<pasta privada>/B2B.csv'
python PostgreSQL/legacy_rpa_etl/extended.py prepare --stage '<staging privado>' --run-id '<UUID>' --kind driver --file '<pasta privada>/MOTORISTAS.csv'
python PostgreSQL/legacy_rpa_etl/extended.py report --stage '<staging privado>' --run-id '<UUID>'
```

O preparo verifica o complemento contra IDs do snapshot. Complemento inválido ou
ID inexistente impede o preparo dessa categoria. Cadastro sem complemento fica
REJECTED/COMPLEMENT_REQUIRED; não se preenche com dados artificiais. Arquivo vazio
não é evidência de migração: todos os cadastros daquela categoria ficam rejeitados.
B2B exige nome, telefone, CNPJ de 14 dígitos e endereço compatíveis com a estrutura.
Esse teste não comprova autenticidade do CNPJ; CPF do motorista tem verificadores
validados e CNH tem formato de 11 dígitos, sem comprovação documental automática.
Categoria deve existir no catálogo oficial do destino: o loader não a inventa.

## Carga e reconciliação

Somente com destino, TLS, passfile e confirmação literal já configurados conforme
README.md, habilitar OLIUS_ETL_EXTENDED_LOAD_ENABLED=true e executar:

```powershell
python PostgreSQL/legacy_rpa_etl/extended.py load --stage '<staging privado>' --run-id '<UUID>'
python PostgreSQL/legacy_rpa_etl/extended.py reconcile --stage '<staging privado>' --run-id '<UUID>'
```

Uma transação por cadastro: B2B insere endereço próprio, usuário, telefone, QR,
establishment e proveniência. Motorista insere driver e proveniência. Auditoria
SYSTEM registra motivo/lote; triggers e constraints continuam ativas. Falha desfaz
todos os elementos daquela unidade. Outros cadastros já confirmados permanecem.
Não são importados saldos, planos contratados, pagamentos, PEVs, coletas ou certificados.
Datas de cadastro são do instante da importação; não se inventam datas históricas.

A identidade origem/tipo/ID é serializada por bloqueio transacional. Fingerprint dos
dados preparados/complementos não inclui a senha aleatória. Reexecução reconhece o
mapeamento confirmado sem substituir senha, status ou perfil editados na aplicação.
Mudança nos dados preparados gera conflito; documento/e-mail já existente não é
mesclado automaticamente. Colisão concorrente por outra identidade pode produzir
erro de integridade e interromper a tarefa. Retomar o lote reconhece commits já
confirmados, inclusive se o processo caiu antes do checkpoint SQLite.

A reconciliação verifica cada candidato READY, o resultado de carga e os vínculos
estruturais/proveniência; rejeitados não são considerados importados. Resultados
incompletos/conflitantes fazem falhar. Lote não pode apontar depois para outro alvo.
Não reexecutar preparação após tentativa de carga B2C ou ampliada; usar carga para
retomada ou novo lote para reavaliar mudanças. CPFs textuais nos complementos e no
staging exigem diretório privado e retenção controlada.

## Airflow e preservação

compose.extended.yaml monta os dois CSVs como arquivos privados somente leitura e
ativa a preparação complementar dentro da tarefa existente. Escrita continua
independente, com OLIUS_ETL_LOAD_ENABLED=true, OLIUS_ETL_EXTENDED_LOAD_ENABLED=true
e compose.load.yaml; nenhuma flag é ativada automaticamente. Adicionar compose.cpf.yaml
e/ou compose.archive.yaml quando necessários. Não alterar o .env pessoal nem
reiniciar o ambiente automaticamente. Arquivos da pipeline são montados pelo Compose.

O histórico mantém os registros originais B2B/MOTORISTA mesmo após importar o
cadastro: Plano, empresa_resp, telefone do motorista e outros campos não possuem
mapeamento aprovado no destino. O motivo os identifica como parcialmente mapeados;
não representam operações atuais ou permissões. Não arquivar os CSVs privados
como relatório público. A cópia protegida e seu backup mantêm as políticas aprovadas.

## Limites do aceite

Os CSVs originais foram preenchidos em 05/11/2026 com complementos sintéticos
autorizados pela equipe; a origem também é simulada. Esses dados não comprovam
identidade, posse de e-mail ou recuperação de conta em produção. Os testes usam dados fictícios e PostgreSQL
isolado, incluindo reenvio, preservação de senha alterada, reconciliação, conflito
e rollback. Não houve instalação/carga no Aiven, envio de e-mail ou validação de
posse de e-mail real. Execução remota de CI/Sonar e aceite de dados continuam pendentes.
