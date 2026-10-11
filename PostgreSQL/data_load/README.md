# Data Load — OLIUS

Carga artificial para o requisito de Modelagem de Dados do segundo ano: pelo menos 500 registros verossímeis. Esta entrega cria 600 operações de negócio, além dos cadastros, e valida seus efeitos pelas rotinas existentes. Não modifica a modelagem nem desativa constraints ou triggers.

## Conteúdo

| Arquivo | Responsabilidade |
|---|---|
| `config.json` | Três planos oficiais documentados; níveis de certificado vazios enquanto suas metas não forem definidas. |
| `00_helpers.sql` | Identificadores determinísticos, contexto de auditoria e verificações temporárias. Não cria objetos permanentes da aplicação. |
| `01_seed.sql` | 112 usuários da aplicação (2 ADM, 80 cidadãos e 30 estabelecimentos), QR Codes, telefones, 38 endereços, 5 motoristas e 8 PEVs aprovados. |
| `02_contracts.sql` | 30 assinaturas e seus pagamentos simulados; aplicação pelas procedures, 2 upgrades e 1 pagamento duplicado que pede reembolso. |
| `03_journeys.sql` | 200 coletas, 400 entregas, 40 pedidos adicionais, reenvios, correções e anulações. |
| `04_validate.sql` | Quantidades, saldos calculados de forma independente, componentes, limites dos ciclos, vínculos PEV/validador, revisões e auditoria. |
| `run.py` | Pré-condições, instalação opcional, execução em etapas, logs e relatório JSON. |
| `test_runner.py` | Validação das configurações e da recusa de destinos não identificados como descartáveis. |
| `VALIDACAO.md` | Resultado dos testes realizados nesta entrega. |

## Configurações oficiais

Fonte: documentos `Contexto do Projeto - OLIUS.docx` e `Regras de Negocio - OLIUS.docx` da pasta `01_Sobre/Técnico`.

| Plano | Preço mensal | Litros | Coletas |
|---|---:|---:|---:|
| Básico | R$ 19,90 | 50 | 2 |
| Profissional | R$ 39,90 | 220 | 4 |
| Empresa | R$ 79,90 | 500 | 8 |

Os 30 estabelecimentos chegam ao Plano Empresa: dois começam nos planos inferiores e recebem upgrade pago antes das coletas; os demais começam no Empresa. Isso permite oito pedidos originais por estabelecimento sem aumentar franquias artificialmente. Os upgrades mantêm as datas e substituem os limites, sem somá-los.

Os nomes/metas dos certificados ainda estão pendentes nos documentos. `certificate_levels` fica vazio; a massa não cria certificados. Não existe dependência de cadastrar níveis para registrar óleo ou calcular pontos.

As categorias de estabelecimento e todos os cadastros pessoais são dados de demonstração. São marcados com `[DEMO]`, e-mails em domínio reservado `.invalid`, documentos sintéticos e coordenadas ilustrativas. As CNHs atendem ao formato exigido pelo banco, sem representar habilitações verificadas.

`password_hash` contém um marcador sem credencial utilizável. Estes usuários servem para modelagem/jornadas no banco, não para login no frontend. Esta entrega não define senhas de usuários PostgreSQL nem divulga uma senha comum da aplicação.

## Cenários

- 160 coletas originalmente bem-sucedidas e 40 malsucedidas: ausência de óleo, óleo inadequado, ocorrência comprometedora e recolhimento fora da faixa.
- Dez pedidos PENDING, dez REJECTED, dez cancelamentos FREE e dez LATE_FORFEITURE. Rejeição ocorre somente enquanto PENDING.
- 400 entregas B2C de volume positivo, incluindo frações inferiores a um litro. O beneficiário nunca valida a própria entrega.
- Reenvio de cada pedido, coleta e entrega, com chave/payload original, sem duplicações; reenvio do primeiro pagamento sem novo benefício.
- Uma correção e uma anulação em cada perfil. Restam **598 operações RECORDED**: 199 coletas (159 sucessos e 40 falhas) e 399 entregas. Todas as 600 identidades são preservadas, inclusive anuladas.
- Dois upgrades reais no fluxo simulado e um reembolso integral REQUESTED por benefício duplicado. Não há chamada a provedor financeiro ou movimentação de dinheiro.

No máximo oito solicitações por estabelecimento neste ciclo. Portanto não há demonstração de dez sucessos do mesmo estabelecimento: a recorrência exige ciclos/histórico adicionais e já possui testes de regressão próprios. Nenhum limite foi aumentado para forçar esse cenário.

B2B usa horários reais da execução, com criação, agendamento, chegada, aceite e registro pelas rotinas. B2C distribui as datas físicas em até 14 dias do mês vigente, pois a rotina permite registro posterior; evita fatos futuros. Esta entrega não é uma série histórica de vários meses para BI.

## Executar em PostgreSQL 16.15 descartável

Requer Docker e Python 3. Não há bibliotecas Python adicionais. Execute os comandos abaixo da raiz do repositório, em PowerShell.

```powershell
docker run -d --name olius-data-load --label org.olius.data_load.disposable=true --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=olius_data_load postgres:16.15-bookworm
docker exec olius-data-load pg_isready -U postgres -d olius_data_load
```

Espere `pg_isready` indicar que aceita conexões. Este container não expõe portas e usa autenticação sem senha somente nesse ambiente isolado, acessado via `docker exec`.

```powershell
$env:OLIUS_DATA_LOAD_DISPOSABLE='1'
python PostgreSQL/data_load/run.py --container olius-data-load --install --install-access-control
```

`--install` exige schema public vazio e instala 01–05. Aceita o nome antigo ou o novo do script 04, mas recusa a presença de ambos. Instala 06/07 somente quando o 07 existe. `--install-access-control` instala o catálogo e os scripts existentes de papéis/contas **somente no container**, e executa as jornadas sob `olius_api`. Cadastros e configuração financeira preparatória usam a conta de implantação; nenhuma escrita livre é concedida à Core.

Para testar só a estrutura e as rotinas, omita `--install-access-control`. Se `olius_api` já estiver presente, as jornadas usam esse papel; ele precisa estar configurado pelos scripts oficiais. Na ausência dele, o relatório registra execução como `postgres`. A escolha do papel é registrada em `journeys_role`.

O runner exige que todas as tabelas operacionais e logs estejam vazios antes da carga. Só os três metadados do catálogo são excluídos dessa verificação. Não executa DELETE/TRUNCATE nem remove objetos existentes.

Cada etapa SQL é transacional e interrompe em erro. Há commits entre etapas: se uma etapa falhar, as anteriores podem permanecer. O runner recusa reaplicar a massa nessa base parcial. Recrie somente o container descartável para uma nova execução:

```powershell
docker rm -f -v olius-data-load
```

Depois repita a criação e a execução. IDs de cadastros/chaves de reenvio são estáveis; IDs derivados e instantes são gerados pelas rotinas, então o relatório não promete igualdade byte a byte de duas execuções.

## Evidências e limites

O runner grava `reports/manifest.json` e logs por etapa. O manifesto inclui versão do PostgreSQL, hashes dos scripts, configuração, papel das jornadas, etapas concluídas e contagens finais. `reports/` é ignorada pelo Git; `VALIDACAO.md` resume a evidência publicável.

```powershell
python -m unittest discover -s PostgreSQL/data_load -p test_runner.py
```

A validação das views, quando presentes, ocorre administrativamente. O acesso das integrações às novas views continua sujeito ao ajuste apontado na PR #21; carregar dados não corrige permissões nem publica pontos no Redis.

A carga não foi executada no Aiven. O runner aceita somente containers identificados como descartáveis; execução futura em banco compartilhado exige revisão do destino e da política de reexecução. Massa inicial não substitui a integração RPA/ETL exigida em outra etapa da disciplina.
