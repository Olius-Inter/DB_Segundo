# OLIUS — Resultado da migração acadêmica

Execução em 05/11/2026, autorizada pela equipe. Origem banco_olius e destino
oliusdb_segundo no servidor Aiven do projeto, ambos com dados simulados. Nenhum
cadastro deve ser apresentado como dado pessoal confirmado ou operação real.
Lote: 632efe97-3ed8-47f4-892b-e1480d331cb8.

## Carga e reconciliação

| Perfil | Importados | Rejeitados |
|---|---:|---:|
| Cidadão | 1 | 5 |
| Estabelecimento | 2 | 0 |
| Motorista | 2 | 0 |

Os cinco cidadãos rejeitados falharam nos dígitos verificadores do CPF. Não foram
corrigidos artificialmente. Os CSVs originais receberam os complementos sintéticos
aprovados, mantendo os IDs da origem. Os exemplos separados não foram usados.

| Tabela de negócio | Antes | Depois da carga e do reenvio |
|---|---:|---:|
| users | 6 | 9 |
| citizens | 3 | 4 |
| establishment | 2 | 4 |
| driver | 3 | 5 |

A proveniência confirmou 1 cidadão, 2 estabelecimentos e 2 motoristas. As rotinas
de reconciliação passaram. A segunda execução retornou ALREADY_IMPORTED para os
cinco cadastros, sem duplicações nem substituição de senha. Nenhuma rotina de
pontuação, coleta, entrega, contratação ou certificado foi usada para inventar fatos.
O legado foi acessado somente para leitura. Os registros anteriores do destino
foram preservados. Não houve adaptação da API ou alteração de suas tabelas nesta carga.

A conta pedro realizou a carga. A instalação dos controles técnicos foi executada
separadamente pelo responsável na conexão administrativa. Servidores consultados
estavam em PostgreSQL 18.6, embora o alvo de compatibilidade/testes do projeto seja
16.15. Nenhuma alteração de versão do servidor foi feita nesta atividade.

## Backup e preservação

Antes da carga, pg_dump 18 gerou backup completo em formato custom, criptografado
localmente com chave separada. O catálogo do dump pôde ser lido e a descriptografia
foi verificada. Não foi executada restauração completa desse backup em outro banco.

O histórico cifrado preservou 66 registros/referências, incluindo rejeições, fatos
sem mapeamento e campos legados de cadastros parcialmente mapeados. Não significa
66 erros: inclui evidências e dados sem equivalente no esquema atual. Hashes de
senha e outros campos de credenciais são excluídos do histórico.

A cópia local do histórico foi comparada e aberta com sucesso. O relatório
compartilhado contém somente agregados; as chaves e o staging permanecem em pasta
privada, fora do Git. Não publicar CSVs preenchidos, hashes, dumps ou chaves no PR.

## Forma de execução e limites

Nesta carga do Aiven, os módulos Python foram executados diretamente. Não afirmar
que esse lote passou pelo scheduler do Airflow. A orquestração completa pelo
scheduler foi validada separadamente em rede Docker interna com origem/destino
fictícios, quatro execuções e dados B2C/B2B/motorista (SCHEDULER_VALIDATION.md).

Ainda não verificados nesta execução:
- Sincronização do OneDrive e permissões de compartilhamento efetivas.
- Recuperação independente da chave/cópia pelo Caio.
- Restauração integral do backup pré-carga.
- Data da avaliação final para fixar o descarte em +90 dias.
- Envio de e-mail e definição da primeira senha via Core: e-mails de complemento
  usam example.invalid, portanto não recebem mensagens. O hash inicial impede
  login por senha conhecida; o fluxo de recuperação exige endereço alcançável
  para uma demonstração de autenticação separada.
- Execução remota de CI/Sonar e aceite do professor quanto ao uso do Airflow.

Resultados agregados e caminhos das evidências locais estão na pasta privada
OLIUS_Privado/HistoricoLegado/04_Preparacao_Demonstracao. O relatório do histórico
foi salvo na pasta compartilhada aprovada, sem valores de titulares.
