# PR 13 — correções das procedures

## Arquivos

- `04_functions_procedures_window_functions.sql`: código completo atualizado, com três functions e dez procedures na ordem de dependência existente. Não copiar fragmentos por cima de uma procedure: usar o arquivo integrado.
- `tests/fixtures_procedures.sql`: dados artificiais de testes, separados da população do projeto.
- `tests/procedures_regression.sql`: testes funcionais com ROLLBACK ao final.
- `tests/procedures_concurrency.py`: sete cenários com duas sessões reais e confirmação de espera de lock.

O CI foi preservado: as alterações propostas em `../.github/workflows/ci.yml` foram revertidas a pedido do responsável pelas procedures. Os testes deste pacote não são executados automaticamente pelo workflow atual; sua integração deve ser decidida pelo responsável pelo CI.

Considerando a PR inteira, os Scripts 01 e 02 foram alterados: `01_structure.sql` adiciona chaves de idempotência, constraints de unicidade e `delivery_pev.processing_order`; `02_check_constraints.sql` adiciona `ck_delivery_pev_order`. `03_indexes.sql` não foi alterado. Essas mudanças estruturais já estavam presentes antes da última rodada de correções das procedures.

## Comentários atendidos

1. **Correção B2C:** restauradas autorização, validações, UPDATE, incremento da revisão e metadados; anulação preserva dados físicos, reativação recalcula, e a ordem permanece intacta.
2. **Idempotência:** pedidos, coletas e entregas comparam os dados originais; conflito usa SQLSTATE `22000`. As coletas usam a solicitação como identidade da operação única. Os motivos são comparados como conjunto (ordem e duplicatas não alteram a operação).
3. **Motivos:** elementos NULL/vazios são rejeitados antes de ANY/COUNT, tanto no registro quanto na correção. Motivos obrigatórios continuam correspondendo aos fatos.
4. **Cancelamento:** chegada pontual usa `< scheduled_at + 1 hour`; exatamente no limite é atraso. Aceite impede cancelamento com erro de negócio explícito.
5. **Renovação:** ciclo futuro não pode originar outra antecipação; renovação contínua e retomada após interrupção preservam os contratos já aprovados.
6. **Pagamentos tardios:** benefício duplicado e upgrade expirado alcançam seus reembolsos mesmo com cobrança CANCELLED/EXPIRED. Outros casos são rejeitados para análise administrativa, sem conceder benefício ou criar outra política de reembolso.
7. **Bloqueios:** correções bloqueiam participante antes do evento e conferem a revisão depois da releitura. Registro B2B também bloqueia estabelecimento antes de solicitação. Reconstruções já usam o mesmo participante.
8. **Sonar:** literais de status, tipos, motivos, erros e mensagem administrativa foram substituídos por constantes locais; limites e valores de pontuação também receberam nomes. Não há mecanismo de constantes globais nem alteração dos ENUMs. A nova análise Sonar ainda deve confirmar seus apontamentos; não se promete zero alertas.

Não foi usado zero provisório para coletas vigentes: os valores gravados respeitam o CHECK imediato de pontuação antes da reconstrução.

## Contrato com a API

- Gerar/preservar a UUID antes do primeiro envio. Timeout não comprova falha: repetir chave e dados originais. Operação nova recebe outra chave.
- SQLSTATE `22000` emitido por estes conflitos de idempotência deve virar HTTP 409. Não tratar como sucesso nem gerar outra chave automaticamente.
- Após uma correção, reenvio original retorna o mesmo ID sem desfazer a correção. A API consulta o estado atual; o resultado não é uma cópia literal do antigo HTTP response.
- Não usar `idempotency_payload`. A comparação lê os snapshots INSERT/AFTER dos logs tipados existentes. Instalar as triggers do Script 05 antes de liberar registros. Manter logs e códigos de catálogo preservados; códigos de motivos devem ser identidades estáveis, não renomeados em lugar de cadastrar uma nova identidade.
- Sem snapshot original, a rotina devolve SQLSTATE `55000`; não inventa um original a partir do registro corrigido. Dados antigos precisam de análise/migração, não de preenchimento fictício.
- Enviar litros finitos com no máximo duas casas decimais, compatíveis com DECIMAL(8,2). A rotina rejeita precisão excedente em vez de arredondar silenciosamente e alterar pontos/dados da comparação.
- `processing_order` vem do banco, nunca do formulário. Não transferir o dono nem alterar a ordem por UPDATE direto. Exclusão física não é um fluxo de correção.
- Operadores vêm da autenticação. Correções enviam revisão esperada e justificativa; SQLSTATE `40001` exige recarregar antes de corrigir (não repetir automaticamente a mesma revisão desatualizada).
- Usar contexto de auditoria com SET LOCAL em uma transação, conforme Script 05: `app.audit_actor`, `app.current_user_id`, `app.operational_driver_id` e `app.audit_reason`, conforme o operador. Não permitir que o cliente escolha livremente esse contexto.
- Registrar o pagamento verificado antes da aplicação. Em casos financeiros não previstos, preservar o fato do pagamento: confirmar esse registro em transação anterior ou usar SAVEPOINT para tratar a exceção da aplicação sem apagar o recebimento. Uma exceção SQL não conclui um reembolso no provedor.
- Restringir DML direto às credenciais confiáveis do backend; as procedures não substituem autenticação/controle de acesso da API.

## Execução dos testes

Somente em **banco descartável vazio**, nunca no banco de trabalho. Com PGHOST, PGUSER, PGPASSWORD e PGDATABASE configurados:

```sh
psql -X -v ON_ERROR_STOP=1 -f PostgreSQL/01_structure.sql
psql -X -v ON_ERROR_STOP=1 -f PostgreSQL/02_check_constraints.sql
psql -X -v ON_ERROR_STOP=1 -f PostgreSQL/03_indexes.sql
psql -X -v ON_ERROR_STOP=1 -f PostgreSQL/04_functions_procedures_window_functions.sql
psql -X -v ON_ERROR_STOP=1 -f PostgreSQL/05_triggers.sql
psql -X -v ON_ERROR_STOP=1 -f PostgreSQL/tests/procedures_regression.sql
python3 PostgreSQL/tests/procedures_concurrency.py
```

Os testes concorrentes deixam fixtures no banco descartável. Para repetir a instalação/concorrência, usar outra base vazia. Não reutilizar uma base com fixtures ou tabelas do projeto já instaladas.

O executor Python lê `fixtures_procedures.sql` da própria pasta de testes e envia seu conteúdo pelo stdin ao psql, tanto no modo local quanto no Docker. Não depende de uma cópia da fixture em `/tmp` no contêiner.

## Evidências e limite da validação local

Executado em PostgreSQL **16.15** isolado no Docker:

- Instalação de 01/02/03/04/05: passou na bateria final, em base descartável nova.
- Regressões de correção/anulação/reativação, reenvio após correção, motivos NULL, piso zero, limites de cancelamento, antecipação/retomada e pagamentos tardios: passaram.
- Bateria ampliada de recorrência nos marcos 10/20/100/110/120, anulação, volume ambiental, revogação/reativação de certificados e precisão/volumes infinitos: passou.
- Sete cenários concorrentes: passaram, incluindo revisão desatualizada, mesmas chaves, ordens distintas e rollback. A espera de lock foi observada em pg_stat_activity, não apenas presumida.
- Conferência de whitespace do diff: passou.

**A bateria final funcional e os sete cenários concorrentes foram executados e passaram sobre o código final.** A execução anteriormente pendente foi posteriormente autorizada e concluída. Os testes não alteraram arquivos do repositório nem utilizaram o banco de trabalho.

Essa evidência cobre os cenários implementados nos testes, não garante ausência de qualquer defeito nem substitui a revisão do parceiro. A nova análise CI/Sonar da PR ainda deve ser conferida após o envio; a validação de negócio relatada aqui foi executada localmente, não pelo workflow atual.
