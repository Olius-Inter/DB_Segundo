# Validação do catálogo — revisão de 06/10/2026

Ambiente: PostgreSQL **16.15**, em contêiner descartável sem portas publicadas e sem rede externa. Nenhum acesso ao Aiven, commit ou PR foi realizado.

## Resultados

| Verificação | Resultado |
|---|---|
| Instalação do catálogo sobre os cinco scripts atuais | Passou |
| Correspondência entre tabelas/colunas reais e catálogo | Sem divergências |
| Cobertura completa | 58 tabelas / 828 colunas |
| Cobertura da view, excluindo catálogo | 55 tabelas / 808 colunas distintas |
| Documentação pendente após atualização | Zero colunas, zero políticas pendentes e zero tabelas sem classificação |
| Migração da carga antiga | As 39 colunas e três tabelas de autenticação foram documentadas |
| Reaplicação da carga | Sem duplicação de metadados |
| Descrição humana existente | Preservada |
| Política humana começando com o mesmo prefixo das políticas geradas | Preservada; substituição depende de igualdade do texto anterior |
| Nova coluna artificial | Descoberta como PENDING, sem inventar regra |
| Cinco perfis documentais | Presentes; owner interno não foi acrescentado como sexto perfil |
| Permissões e ownership após reaplicar 06/07/08 | Passaram na regressão de acessos |
| Regressão das sessões após transferência dos objetos comuns | Passou |
| Regressão existente das procedures como pedro e como caio | Ambas passaram; dados artificiais revertidos |

`05_validate.sql` foi executado novamente após a criação dos papéis; as cinco roles documentais foram reconhecidas no servidor. Na execução anterior aos scripts 06/07, a ausência das roles é esperada e não significa falha de cobertura.

## Arquivos de teste

- `../tests/catalog_access_regression.sql`: cobertura e permissões sob as seis identidades, incluindo negativas e manutenção compartilhada. Executar apenas em base descartável com 01..08 instalados; a transação é revertida.
- `../tests/auth_sessions_regression.sql`: regressão funcional, auditoria, prazos e permissões da autenticação, novamente executada nesta revisão.
- `../tests/procedures_regression.sql`: regressão de negócio existente. Para os testes como integrantes, somente a fixture descartável foi adaptada para usar um schema de teste previamente criado para olius_owner. A versão de produção dos testes/procedures não foi alterada.

Os cenários de colisão de contas, atualização antiga, permissões de implantação e preservação de outro banco foram executados separadamente no mesmo servidor descartável; detalhes em `roles_validation.md`.

## Limites

Esta revisão não alterou o formato da view nem `upgrade_view.sql`; os testes históricos de migração da view realizados na versão anterior não foram repetidos e não são apresentados como novas verificações.

Não houve teste de autenticação por senha, conectividade ou privilégios efetivos no Aiven. O contêiner usou autenticação local de teste, com a identidade PostgreSQL efetiva de cada conta. Testes de concorrência de sessões não foram repetidos nesta alteração de catálogo/perfis.

Sem pendências documentais não significa API completa: acessos de negócio da API, além dos quatro catálogos de referência e das funções de autenticação, continuam fora das concessões desta entrega.
