# Data Load — OLIUS

Carga artificial para o requisito de Modelagem de Dados do segundo ano: pelo menos 500 registros verossímeis. Esta entrega cria 600 operações de negócio, além dos cadastros, e valida seus efeitos pelas rotinas existentes. Não modifica a modelagem nem desativa constraints ou triggers.

## Conteúdo

| Arquivo | Responsabilidade |
|---|---|
| `config.json` | Seed da geração fictícia. Não contém preços, metas ou categorias oficiais. |
| `00_helpers.sql` | Identificadores determinísticos, contexto de auditoria e verificações temporárias. Não cria objetos permanentes da aplicação. |
| `01_seed.sql` | 112 usuários da aplicação (2 ADM, 80 cidadãos e 30 estabelecimentos), QR Codes, telefones, 38 endereços, 5 motoristas e 8 PEVs aprovados. |
| `02_contracts.sql` | 30 assinaturas e seus pagamentos simulados; aplicação pelas procedures, 2 upgrades e 1 pagamento duplicado que pede reembolso. |
| `03_journeys.sql` | 200 coletas, 400 entregas, 40 pedidos adicionais, reenvios, correções e anulações. |
| `04_validate.sql` | Quantidades, saldos calculados de forma independente, componentes, limites dos ciclos, vínculos PEV/validador, revisões e auditoria. |
| `run.py` | Conexão Docker ou direta via psql, proteções, instalação opcional, execução de `initial_data` antes das simulações e relatórios. |
| `test_runner.py` | Validação de configurações, execução e proteções do runner. |
| `VALIDACAO.md` | Resultado dos testes realizados nesta entrega. |

## Configurações oficiais

Fonte dos planos: documentos oficiais da pasta `01_Sobre/Técnico`. Certificados, categorias e motivos foram aprovados pelo responsável em 20/10/2026. A carga compartilhada fica em [`../initial_data/`](../initial_data/README.md); os valores não são redefinidos no JSON nem no seed fictício.

| Plano | Preço mensal | Litros | Coletas |
|---|---:|---:|---:|
| Básico | R$ 19,90 | 50 | 2 |
| Profissional | R$ 39,90 | 220 | 4 |
| Empresa | R$ 79,90 | 500 | 8 |

Os 30 estabelecimentos chegam ao Plano Empresa: dois começam nos planos inferiores e recebem upgrade pago antes das coletas; os demais começam no Empresa. Isso permite oito pedidos originais por estabelecimento sem aumentar franquias artificialmente. Os upgrades mantêm as datas e substituem os limites, sem somá-los.

A carga oficial instala três níveis: Óleo Amigo — Bronze (100 L), Prata (500 L) e Ouro (1.000 L). As concessões fictícias são produzidas pelas rotinas conforme o volume acumulado RECORDED, inclusive coletas malsucedidas com volume recolhido, e reconferidas após correções/anulações. As imagens dos níveis ficam inicialmente sem preenchimento.

Os sete tipos de estabelecimento e os três motivos de falha vêm da carga oficial; a distribuição fictícia utiliza os sete tipos. Todos os cadastros pessoais são de demonstração, marcados com `[DEMO]`, e-mails em domínio reservado `.invalid`, documentos sintéticos e coordenadas ilustrativas. As CNHs atendem ao formato exigido pelo banco, sem representar habilitações verificadas.

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

Para confirmar o servidor definitivo, execute `docker exec olius-data-load psql -h 127.0.0.1 -U postgres -d olius_data_load -X -w -v ON_ERROR_STOP=1 -At -c "SELECT 1;"` e aguarde retornar `1`. O `pg_isready` via socket pode detectar o servidor temporário da inicialização. Este container não expõe portas e usa autenticação sem senha somente nesse ambiente isolado, acessado via `docker exec`.

```powershell
$env:OLIUS_DATA_LOAD_DISPOSABLE='1'
python PostgreSQL/data_load/run.py --container olius-data-load --install --install-access-control
```

`--install` exige schema public vazio e instala 01–05. Aceita o nome antigo ou o novo do script 04, mas recusa a presença de ambos. Instala 06/07 somente quando o 07 existe e instala 08 quando disponível, antes do controle de acesso. `--install-access-control` instala o catálogo e os scripts existentes de papéis/contas **somente no container**, e executa as jornadas sob `olius_api`. Cadastros e configuração financeira preparatória usam a conta de implantação; nenhuma escrita livre é concedida à Core.

Para testar só a estrutura e as rotinas, omita `--install-access-control`. Se `olius_api` já estiver presente, as jornadas usam esse papel; ele precisa estar configurado pelos scripts oficiais. Na ausência dele, `journeys_role` registra o usuário informado em `--user`, ou `postgres` quando essa opção não é informada.

O runner exige tabelas operacionais e logs vazios. Aceita os três metadados documentais e as quatro tabelas de configuração oficial. Dos logs de configuração existentes, aceita somente snapshots SYSTEM vinculados a registros ainda presentes. Em seguida executa e valida `initial_data`; a demonstração exige exatamente 3 planos, 3 níveis, 7 tipos e 5 motivos, recusando configurações adicionais. Dados divergentes não são corrigidos automaticamente. Não executa DELETE/TRUNCATE nem remove objetos existentes.

A carga oficial e cada etapa fictícia têm sua própria transação e interrompem em erro. Há commits entre etapas: se uma etapa falhar, as anteriores podem permanecer. O runner recusa reaplicar a massa nessa base parcial. Recrie somente o container descartável para uma nova execução:

```powershell
docker rm -f -v olius-data-load
```

Depois repita a criação e a execução. IDs de cadastros/chaves de reenvio são estáveis; IDs derivados e instantes são gerados pelas rotinas, então o relatório não promete igualdade byte a byte de duas execuções.

## Evidências e limites

O runner grava `reports/manifest.json` e logs por etapa. O manifesto inclui versão do PostgreSQL, hashes dos scripts, configuração, papel das jornadas, etapas concluídas e contagens finais. `reports/` é ignorada pelo Git; `VALIDACAO.md` resume a evidência publicável.

`--report-dir` aceita somente caminhos dentro de `PostgreSQL/data_load/reports/` ou `coverage/`, na raiz deste repositório. Caminhos externos, escapes com `..` e links simbólicos que saiam dessas pastas são recusados. Arquivos de relatório não podem ser links simbólicos. O padrão e o destino `coverage/data-load` usado pelo CI permanecem válidos.

```powershell
python -m unittest discover -s PostgreSQL/data_load -p test_runner.py
```

A validação das views, quando presentes, ocorre administrativamente. A carga não modifica permissões existentes nem publica pontos no Redis. As MVs do Data Mart instaladas antes das simulações exigem refresh posterior pelo fluxo oficial de BI.

A carga não foi executada no Aiven. O modo padrão exige container identificado como descartável; o modo de desenvolvimento aceita Docker ou conexão direta, exige confirmação explícita do destino e estrutura existente. Massa inicial não substitui a integração RPA/ETL exigida em outra etapa da disciplina.

## Executar no container de desenvolvimento da API

Execute pelo terminal PowerShell na raiz do repositório. Os scripts usam variáveis e comandos do `psql`; não execute os arquivos isoladamente no editor SQL do pgAdmin ou DBeaver, nem pule o `00_helpers.sql`. O runner fornece a configuração e os recursos temporários necessários.

O container deve estar iniciado, com PostgreSQL 16.15 e a estrutura atual já instalada. As tabelas operacionais e seus logs devem estar vazios; configurações oficiais e seus logs SYSTEM são aceitos conforme a pré-condição descrita acima. Pause operações da API durante a carga para evitar gravações concorrentes.

Exemplo com os nomes informados pelo responsável pelo projeto, que precisam corresponder ao destino real:

```powershell
$env:OLIUS_DATA_LOAD_DEVELOPMENT_TARGET = 'olius-local-postgres-dev-1/olius_dev'
python PostgreSQL/data_load/run.py --container olius-local-postgres-dev-1 --database olius_dev --user olius_dev_admin --development
```

- `--container`: nome do container Docker, não o nome do projeto Compose.
- `--database`: nome do banco PostgreSQL dentro do container, não o nome do serviço Docker.
- `--user`: usuário PostgreSQL com privilégios para preparar os cadastros e pagamentos; não é o usuário restrito da API. Se existir `olius_api`, as jornadas continuam usando esse papel e a conta de carga precisa poder assumi-lo.
- `--development`: permite esse destino sem exigir o rótulo de container descartável. A variável deve corresponder exatamente a `container/banco`; ela confirma o destino, não é uma senha.

Não use `--install` ou `--install-access-control` neste modo: o runner bloqueia essas opções para preservar estrutura e permissões existentes. A verificação inicial de tabelas principais não substitui a instalação completa dos scripts atuais.

A conexão ocorre via `docker exec` e `psql`, usando a autenticação local configurada no container; `--user` não define senha nem concede permissões. O runner não solicita senha interativamente. Se houver erro de autenticação, conexão ou permissão, investigue a configuração antes de repetir.

Cada etapa possui seu próprio commit. Uma falha pode deixar carga parcial e impedir nova tentativa; não apague o container da API nem limpe dados automaticamente. Consulte `reports/manifest.json`, identifique a etapa e revise a recuperação do banco de desenvolvimento. O comando de remoção do exemplo anterior é exclusivo do container descartável `olius-data-load`.

Ao terminar, remova a confirmação desta sessão do PowerShell:

```powershell
Remove-Item Env:OLIUS_DATA_LOAD_DEVELOPMENT_TARGET
```

## Conexão direta: PostgreSQL local, Aiven ou outro provedor

Use `--host` no lugar de `--container`. Docker não é necessário nesse modo, mas o cliente **psql** precisa estar instalado e disponível no PATH. Confira com `psql --version`; se não for localizado, adicione ao PATH da sessão a pasta `bin` da instalação PostgreSQL. O runner continua exigindo servidor PostgreSQL 16.15, estrutura completa atual, privilégios de carga e tabelas operacionais e seus logs vazios, admitindo somente as exceções de referência descritas acima. Não há instalação automática de estrutura ou papéis em conexão direta.

A confirmação tem o formato exato `host:porta/banco`. Não use URLs JDBC, URLs com senha ou credenciais dentro de `--host`. Atualmente são aceitos nomes DNS e IPv4.

### Aiven e servidores com TLS

Obtenha host, porta e certificado CA do serviço. A opção padrão é `--ssl-mode verify-full`, que valida o certificado e o nome do servidor. O certificado pode ser informado com `--ssl-root-cert` ou configurado pelo libpq. No Aiven, utilize a CA do projeto, conforme a [documentação oficial](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).

Exemplo ilustrativo: substitua os valores pelo banco de desenvolvimento escolhido antes de executar.

```powershell
$env:OLIUS_DATA_LOAD_DEVELOPMENT_TARGET = 'HOST_DO_SERVICO:26714/BANCO_DE_DESENVOLVIMENTO'
python PostgreSQL/data_load/run.py --host HOST_DO_SERVICO --port 26714 --database BANCO_DE_DESENVOLVIMENTO --user USUARIO_DE_CARGA --development --ssl-root-cert 'C:\certificados\ca.pem'
```

A autenticação usa os mecanismos do cliente PostgreSQL, como um arquivo de senhas protegido indicado por `PGPASSFILE`, ou `PGPASSWORD` definido apenas no ambiente do processo. O runner não recebe senha na linha de comando nem a grava no manifesto. Não versione arquivos de senha. Não há prompt interativo: uma credencial ausente ou incorreta interrompe a execução. As variáveis TLS são aplicadas ao processo psql sem alterar o ambiente da sessão do terminal.

Use a conexão PostgreSQL direta do serviço, sem pool em modo transacional: os scripts dependem de estado de sessão e tabelas temporárias. A conta deve possuir os privilégios atuais de implantação/carga e poder assumir `olius_api` quando esse papel existir. A presença do papel não concede esses direitos automaticamente.

### PostgreSQL local sem TLS

Somente para um servidor local configurado sem TLS, selecione explicitamente `--ssl-mode disable`:

```powershell
$env:OLIUS_DATA_LOAD_DEVELOPMENT_TARGET = '127.0.0.1:5432/olius_dev'
python PostgreSQL/data_load/run.py --host 127.0.0.1 --port 5432 --database olius_dev --user olius_dev_admin --development --ssl-mode disable
```

Em ambos os exemplos, as regras de carga parcial e recuperação da seção anterior continuam válidas. O runner não limpa nem recria o banco. Não direcione esta massa a produção. Cada etapa SQL é executada pelo psql local com seus includes locais; nenhum SQL foi adaptado ou enviado como arquivo ao filesystem do servidor remoto.

O manifesto passa a registrar transporte, destino, usuário e modo TLS, sem incluir a senha. Ao terminar, remova `OLIUS_DATA_LOAD_DEVELOPMENT_TARGET` e qualquer variável de credencial temporária configurada por você.

## Integração ao CI

O workflow executa os testes do runner com `coverage.py`, exige pelo menos 80% de cobertura e exporta `coverage/data-load-python.xml` para o Sonar. Os testes Python são classificados como testes, não como código de produção.

A carga completa roda em outro container, isolado dos testes de regressão. Logs e manifesto ficam em `coverage/data-load/`, publicados junto dos relatórios existentes. O runner valida os identificadores externos e cria seus arquivos em um diretório exclusivo com `mktemp -d`, sob `/var/lib/postgresql`, com permissões restritas. Esse diretório é removido ao terminar.


A linha singleton de admin_guard_state é uma exceção técnica à pré-condição de
banco vazio. Convites e seus logs precisam estar vazios. Os dois ADMINs [DEMO]
são fixtures inseridas pela conta de implantação, não pelo cadastro público.
Nenhuma conta ADMIN real ou convite de produção é criado pela demonstração.
