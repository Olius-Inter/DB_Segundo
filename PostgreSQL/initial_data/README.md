# Carga oficial inicial do OLIUS

Configurações compartilhadas por produção e desenvolvimento, aprovadas em
20/10/2026. Não cria contas ADMIN, senhas, operações ou certificados concedidos.
A conta inicial do Gmail do projeto pertence à entrega de provisionamento seguro.

| Tabela | Registros oficiais |
|---|---|
| `subscription_plan` | Básico: R$ 19,90, 50 L e 2 coletas; Profissional: R$ 39,90, 220 L e 4 coletas; Empresa: R$ 79,90, 500 L e 8 coletas. Valores por ciclo mensal. |
| `certificate_level` | Óleo Amigo — Bronze: 100 L; Óleo Amigo — Prata: 500 L; Óleo Amigo — Ouro: 1.000 L. |
| `establishment_type` | Restaurante; Lanchonete; Padaria e confeitaria; Bar; Hotel e pousada; Cozinha institucional; Outro. |
| `collection_failure_reason` | `VOLUME_OUT_OF_TOLERANCE`, `OIL_UNACCEPTABLE` e `COMPROMISING_OCCURRENCE`. |

São **16 registros**, além dos logs gerados pelas triggers nos três catálogos
auditados. `establishment_type` não possui tabela de log.
Os certificados usam litros efetivamente coletados nas operações RECORDED,
inclusive malsucessos com recolhimento; sem reinício anual. Imagens/descrições
opcionais não são impostas pela carga. O motivo de volume acompanha a regra
atual das rotinas: volume recolhido comparado à estimativa; não altera a classificação.

## Arquivos e execução

1. Instalar os scripts principais 01–08, os scripts do catálogo e os papéis
   conforme o README de `access_control`.
2. Selecionar e conferir o banco de destino no cliente.
3. Executar **inteiramente** `01_reference_data.sql`.
4. Executar `02_validate.sql`.

Os dois scripts são SQL PostgreSQL comum, sem variáveis de psql ou includes.
Podem ser executados no pgAdmin/DBeaver ou com psql. Cada arquivo controla sua
própria transação; executar fora de outra transação. Em erro, fazer ROLLBACK.
A carga não atualiza as materializações de BI. Após configurar/popular o banco,
executar o refresh pelo script 09 ou pelo Job autorizado para refletir os dados em `dm`.

`02_validate.sql` executa em transação de somente leitura e reporta ausência,
ambiguidade ou divergência; não corrige dados. O contrato esperado é explícito
nesse validador para conferir independentemente o resultado da instalação.

Usar a conta de implantação autorizada, com leitura, inserção e autoridade
para bloquear os quatro catálogos, além das permissões necessárias às triggers.
Não usar o reader BI nem as contas de refresh. Senhas ficam fora do Git.

## Reexecução e conflitos

- Tudo é inserido em uma transação, com contexto de auditoria SYSTEM e motivo
  `Carga inicial oficial OLIUS v1`.
- Bloqueios nas quatro tabelas serializam a carga e impedem mudanças concorrentes
  durante a conferência/inserção. Podem aguardar outras operações; executar na
  janela de implantação.
- Nome identifica planos, tipos e níveis; código identifica motivos de falha.
- Registros compatíveis já existentes mantêm seus IDs, timestamps, descrições
  opcionais e imagens. Não são feitos UPDATEs nem novos logs nesses registros.
- Registros ausentes recebem UUID determinístico em namespace próprio,
  independente dos IDs fictícios da demonstração.
- Preço, limites, metas, nomes dos motivos ou status divergentes causam erro;
  a transação inteira é revertida, incluindo os logs. Uma colisão de UUID
  também é recusada pela PK. Nenhum objeto preexistente é removido.
- Mais de um nível com o mesmo nome é ambíguo e causa erro, mesmo com metas
  iguais. Não foi adicionada uma nova constraint à modelagem.
- Outros registros legítimos são preservados e não impedem a validação oficial.
  A massa de demonstração, por sua vez, exige apenas os 16 registros aprovados.

Esta é a versão inicial do catálogo, não um mecanismo para impor preços/metas
antigos a um sistema em operação. Se houver mudança comercial deliberada,
versionar a alteração e o contrato de validação; não reaplicar esta carga para
sobrescrever configurações atuais. Cadastrar níveis em banco já movimentado
também não reconcilia certificados retroativamente: planejar essa manutenção.

## Desenvolvimento e CI

O runner de `data_load` executa esta mesma carga e o validador antes das
simulações. O JSON da demonstração contém somente a seed; não redefine catálogos.
Não executar o runner de demonstração em produção.

`PostgreSQL/tests/initial_data_regression.py` verifica a carga real em banco
descartável próprio: 16 registros, nenhuma conta criada, concorrência, reexecução sem escrita,
IDs existentes, categorias adicionais, divergências, rollback e nomes duplicados.
Ele é chamado pelo runner do CI e nunca deve ser apontado para produção.
