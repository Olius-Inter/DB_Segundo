# Alterações aprovadas — ordem de processamento B2C

Arquivo de preparação para aplicação manual. Os Scripts 01, 02 e 04 não foram modificados. As linhas abaixo são referências da versão consultada; use os nomes das tabelas e procedures como localização principal.

Este guia cobre a alteração aprovada de `delivery_pev.processing_order` e seus efeitos diretos. As demais correções da PR (idempotência, motivos, cancelamento, pagamentos, constantes e bloqueios B2B) continuam sendo uma etapa separada; este arquivo não as implementa.

## Regra

Cada cidadão possui sua própria sequência crescente de entregas. O registro comum acrescenta um evento ao final, mesmo que `delivery_date` seja anterior ao de outra entrega. Correção, anulação e reativação preservam a ordem original. Entregas anuladas continuam ocupando sua ordem: não reutilizar números nem filtrar anuladas ao calcular o máximo.

O campo é atribuído pelo banco, não pelo formulário/API. Não possui DEFAULT: sua atribuição depende do bloqueio do cidadão. Lacunas são aceitáveis; positividade e unicidade não exigem sequência sem lacunas. Evitar exclusão física de eventos históricos.

## 1. Script 01 — estrutura

Arquivo: `01_structure.sql`.

### 1.1 Campo

Dentro de `CREATE TABLE delivery_pev` (linha 579), imediatamente depois de `citizen_id UUID NOT NULL,` (linha 585), adicionar:

```sql
    processing_order BIGINT NOT NULL,
```

### 1.2 Unicidade por cidadão

No bloco de constraints da mesma tabela, depois de `uq_delivery_owner` (linha 595), adicionar:

```sql
    CONSTRAINT uq_delivery_order UNIQUE (citizen_id, processing_order),
```

A ordem 1 pode existir para vários cidadãos; não pode se repetir para o mesmo cidadão. O índice criado pela UNIQUE já atende à busca por cidadão e ordem; não adicionar outro índice equivalente.

### 1.3 Documentação da coluna

Na seção de comentários, depois de `COMMENT ON COLUMN collection.processing_order` (linhas 706–707), adicionar:

```sql
COMMENT ON COLUMN delivery_pev.processing_order IS
'Ordem fixa por cidadão para reconstruir pontos e saldos, independente da data física da entrega. Atribuída sob bloqueio do cidadão e preservada nas correções.';
```

### 1.4 Auditoria

`delivery_pev_log` usa `LIKE delivery_pev` (linha 1110). Em uma criação nova, executando o Script 01 atualizado, o campo e seu NOT NULL serão copiados automaticamente. Não repetir a UNIQUE no log: várias versões da mesma entrega devem poder conservar a mesma ordem.

Revisar a futura rotina de auditoria: se enumerar colunas explicitamente, incluir `processing_order` nos snapshots. `LIKE` sozinho não preenche o histórico.

## 2. Script 02 — CHECK de positividade

Arquivo: `02_check_constraints.sql`.

Na seção de `delivery_pev`, depois de `ck_delivery_pev_points` e antes de `ck_delivery_pev_dates` (aproximadamente linhas 523–529), adicionar:

```sql
-- A ordem B2C é positiva e independente da data física da entrega.
-- A atribuição e a preservação da ordem dependem das rotinas.
ALTER TABLE delivery_pev
    ADD CONSTRAINT ck_delivery_pev_order
    CHECK (processing_order > 0);
```

O NOT NULL fica no Script 01; o CHECK fica no Script 02, seguindo a organização existente. Não alterar `ck_collection_order`, que já valida a ordem B2B.

## 3. Script 04 — reconstrução

Arquivo: `04_functions_procedures_window_functions.sql`.

Em `rebuild_user_points`, somente no loop das entregas B2C (linha 525), substituir:

```sql
            ORDER BY d.delivery_date, d.id
```

por:

```sql
            ORDER BY d.processing_order, d.id
```

A UNIQUE garante ausência de empate de ordem dentro do cidadão. Manter o bloqueio de `citizens` já existente na reconstrução. Não alterar a ordenação das coletas B2B nem a fórmula de pontos B2C.

## 4. Script 04 — registro de entrega

Em `record_pev_delivery` (linha 1385), adicionar ao DECLARE:

```sql
    v_order BIGINT;
```

Depois de validar o cidadão e impedir autovalidação, antes do `SELECT ... FROM public.pev ... FOR SHARE` (linha 1428), adicionar:

```sql
    -- Mesmo bloqueio usado pela reconstrução e pela correção B2C.
    -- Chamadas para o mesmo cidadão aguardam a transação anterior.
    PERFORM 1
    FROM public.citizens AS c
    WHERE c.id = p_citizen_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'O cidadão beneficiário não existe.'
            USING ERRCODE = 'P0002';
    END IF;
```

Depois das validações do PEV/validador e imediatamente antes do INSERT (linha 1453), adicionar:

```sql
    -- Inclui anuladas: a identidade de processamento não é reciclada.
    SELECT COALESCE(MAX(d.processing_order), 0) + 1
    INTO v_order
    FROM public.delivery_pev AS d
    WHERE d.citizen_id = p_citizen_id;
```

Substituir o INSERT atual por:

```sql
    INSERT INTO public.delivery_pev (
        oil_volume_liters, points_earned, delivery_date, citizen_id,
        processing_order, pev_id, validated_by, idempotency_key,
        record_status, revision
    ) VALUES (
        p_oil_volume_liters, FLOOR(p_oil_volume_liters)::BIGINT,
        p_delivery_date, p_citizen_id, v_order, p_pev_id,
        p_validator_id, p_idempotency_key,
        'RECORDED'::public.record_status_t, 1
    ) RETURNING id INTO p_delivery_pev_id;
```

Preservar a chamada de `rebuild_user_points` na mesma transação. O bloqueio permanece até COMMIT/ROLLBACK. Todos os caminhos que gravam entregas devem respeitar o mesmo bloqueio; a UNIQUE é a última proteção, não substitui o protocolo.

O fluxo de reenvio idempotente existente retorna antes de emitir uma ordem, portanto não consome outra posição. A comparação com os dados originais após correções será implementada na correção separada de idempotência; os trechos deste guia não resolvem esse requisito.

## 5. Script 04 — correção administrativa B2C

`correct_pev_delivery` não deve modificar `processing_order` no UPDATE. O UPDATE atual já não contém essa coluna; preservar esse comportamento.

Para usar a mesma ordem de bloqueios da reconstrução, substituir o trecho que começa no `SELECT ... delivery_pev ... FOR UPDATE` (linha 1624) e termina na verificação de `expected_revision` (linha 1628) por:

```sql
    -- Leitura inicial apenas para localizar o participante.
    SELECT d.* INTO v_delivery
    FROM public.delivery_pev AS d
    WHERE d.id = p_delivery_pev_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A entrega % não existe.', p_delivery_pev_id
            USING ERRCODE = 'P0002';
    END IF;

    PERFORM 1
    FROM public.citizens AS c
    WHERE c.id = v_delivery.citizen_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'O cidadão beneficiário não existe.'
            USING ERRCODE = 'P0002';
    END IF;

    -- Releitura após o bloqueio: a revisão inicial pode estar desatualizada.
    SELECT d.* INTO v_delivery
    FROM public.delivery_pev AS d
    WHERE d.id = p_delivery_pev_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A entrega % não existe.', p_delivery_pev_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_delivery.revision <> p_expected_revision THEN
        RAISE EXCEPTION 'A entrega mudou desde a leitura. Recarregue o registro antes de corrigir.'
            USING ERRCODE = '40001';
    END IF;
```

Esse protocolo pressupõe que `citizen_id` não seja transferido por outro caminho; a procedure atual não o altera. Manter validações de administrador, parâmetros e justificativa já existentes.

## 6. Aplicação e bancos já existentes

Para um banco novo: incorporar os trechos nos scripts e executar 01 → 02 → demais scripts, respeitando dependências → 04. Ajustar qualquer população B2C para fornecer uma ordem positiva e única por cidadão ou usar a procedure de registro.

Para um banco já criado: editar arquivos não altera o banco. É necessária uma migração separada, com backup e gravações suspensas. Não executar o Script 01 inteiro sobre as tabelas existentes.

A migração deve adicionar a coluna inicialmente sem NOT NULL, preencher ordens preservando a sequência histórica usada nos cálculos existentes (`delivery_date, id` no código atual), conferir os cálculos, aplicar NOT NULL/UNIQUE/CHECK e atualizar as procedures antes de liberar gravações. Não escolher uma nova ordem histórica sem avaliar os saldos e a auditoria.

O log existente também precisa receber a coluna. Snapshots históricos não têm ordem originalmente registrada: definir explicitamente a estratégia de preenchimento antes de impor NOT NULL no log. Não criar um valor fictício para aparentar histórico conhecido. Por isso este guia não inclui uma migração automática para bases com dados.

## 7. Verificações antes da PR

- Ordem 0 e negativa: rejeitadas pelo CHECK; NULL: rejeitado pelo NOT NULL.
- Mesmo cidadão e mesma ordem: rejeitados pela UNIQUE; cidadãos diferentes podem ter a mesma ordem.
- Registrar 10h05 e depois 10h00: a segunda entrega recebe a próxima ordem, e os cálculos anteriores permanecem iguais.
- Horários físicos iguais: ordens diferentes, sem ambiguidade.
- Duas sessões registrando para o mesmo cidadão: a segunda aguarda; após a primeira confirmar, recebe a próxima ordem. Testar também rollback da primeira.
- Duas correções de entregas do mesmo cidadão: participante bloqueado antes das entregas; revisar ausência de deadlock nesse fluxo.
- Duas correções da mesma entrega com a mesma revisão esperada: a segunda rejeita a revisão desatualizada.
- Correção de volume/data, anulação e reativação: preservam a ordem; recálculo administrativo continua auditado.
- Reenvio com a mesma chave não insere outra entrega nem emite outra ordem.
- Snapshot de auditoria inclui a ordem após a alteração.

Os trechos foram conferidos contra os scripts locais, mas não foram executados em PostgreSQL. Este guia não equivale à validação completa das demais correções da PR.
