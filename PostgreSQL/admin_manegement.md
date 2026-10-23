# Administradores, convites e proteção de acesso

Contrato aprovado em 20/10/2026. O Gmail do projeto será o destinatário do
primeiro ADMIN; nenhum endereço real, conta, token ou senha é provisionado
automaticamente pelos scripts desta entrega.

## Fluxo

1. Na implantação, operador autorizado emite o bootstrap pelo papel olius_owner.
   A Core não recebe EXECUTE nessa operação e ela não deve virar endpoint público.
   A operação só funciona enquanto nenhum usuário ADMIN estiver cadastrado,
   inclusive inativos. Reenvio substitui o convite anterior para o mesmo e-mail.
2. A Core gera um segredo com pelo menos 32 bytes aleatórios criptograficamente
   seguros e calcula SHA-256. O banco recebe somente o hash de 32 bytes.
3. Após confirmar a emissão, enviar um link da aplicação com o segredo ao e-mail
   indicado. Guardar o segredo apenas pelo tempo necessário ao envio, fora dos
   logs e do Git. O banco não envia e-mail nem conhece a URL pública da aplicação.
4. O destinatário escolhe a senha. A Core valida sua política, calcula o hash da
   senha e chama accept_admin_invitation com os dois hashes. Hash do convite e
   hash de senha são diferentes: SHA-256 não é o algoritmo de senha recomendado.
5. O banco verifica validade de 24 horas, revogação, uso anterior, e-mail ocupado
   e autor ainda ADMIN ativo. No bootstrap, verifica novamente a ausência de ADMIN.
6. Criação do usuário ACTIVE/ADMIN, consumo do convite e auditoria são atômicos.
   Não há usuário pendente, senha fictícia ou login automático. O novo ADMIN faz
   login pelo mecanismo normal de sessões já implementado.
7. ADMIN ativo pode emitir, reenviar e revogar convites e gerenciar status dos
   demais. Pode inativar a própria conta se outro ADMIN ativo permanecer.

O aceite não aceita e-mail/perfil/autor escolhidos no formulário: utiliza os dados
do convite. E-mail existente, inclusive de cidadão/estabelecimento, bloqueia a
operação; não há promoção automática. Convites usam e-mail normalizado; a API
também deve normalizar seus cadastros/login. Esta entrega preserva a unicidade
histórica case-sensitive de users.email, sem alterar todos os perfis existentes.
Reenvio exige novo segredo e revoga o anterior; não altera o prazo de um token
antigo. Se o emissor for inativado, o aceite é negado enquanto estiver inativo.
Qualquer outro ADMIN ativo pode revogar ou emitir novo convite.

## Banco e permissões

| Objeto | Papel |
|---|---|
| admin_invitation | Dados do convite, hash, emissor e timestamps terminais. Sem senha. |
| admin_invitation_log | Snapshots na mesma transação; sem token original ou hash. |
| admin_guard_state | Uma linha técnica com versão. Não é perfil nem tabela de usuários. |
| users | Preserva a estrutura atual: senha não nula, ACTIVE/INACTIVE e perfil ADMIN. |

issue_admin_invitation, revoke_admin_invitation, accept_admin_invitation e
set_admin_status são SECURITY DEFINER, com proprietário olius_auth_owner e
search_path fixo. A API recebe somente EXECUTE e leitura dos metadados aprovados
do convite, sem hash. O helper create_admin_invitation_internal não é concedido
à Core; o bootstrap é exclusivo da implantação. Nenhum novo papel/login foi criado.

A trigger de users impede INSERT de ADMIN e mudanças diretas de perfil/status
administrativo pela conta técnica. Administração utiliza as funções acima.
O mutex lock_admin_registry também tem EXECUTE para a Core: é usado pela trigger
dos cadastros comuns, não retorna dados e só coordena a linha técnica. Não concede
capacidade de criar administradores ou modificar convites.

Tentativas de inativar/excluir/descaracterizar o último ADMIN ativo são recusadas,
inclusive por manutenção comum. TRUNCATE de users com ADMIN cadastrado é recusado.
O bloqueio usa atualização de uma linha compartilhada: em READ COMMITTED a segunda
operação revalida o estado; em REPEATABLE READ conflitos podem gerar 40001.
Transações de várias linhas também são revertidas se eliminarem o último ADMIN.
Donos de tabelas/superusuários continuam sendo operadores confiáveis com poderes
de manutenção e podem desabilitar proteções; não são contas operacionais.

Inativar revoga sessões pelo mecanismo existente. A API deve consultar a validade
da sessão/usuário, não apenas a assinatura do JWT. A autorização de cada endpoint
continua no backend; p_admin_id vem da identidade autenticada, nunca de um campo
livre do cliente. A conta SQL atende usuários distintos e não há RLS por usuário.

## Instalação

O procedimento adotado pelo projeto é a instalação em banco recriado. Executar
os scripts principais 01–08, catálogo e controle de acesso na ordem documentada.
As estruturas, funções e triggers administrativas já pertencem aos scripts
principais 01–05; as permissões são aplicadas por access_control/01_roles.sql.

Esta pasta contém somente a documentação da funcionalidade; não precisa ser
executada na instalação. Não há gerador de migração nem script administrativo
paralelo. Editar os arquivos principais não atualiza um banco já instalado;
a execução de 01_structure.sql pressupõe um banco sem as tabelas do projeto.

Depois, provisionar o convite do primeiro ADMIN **somente se não houver nenhum**.
Se um banco antigo já tiver ADMIN, ele permanece e o bootstrap é recusado. Se
todos os administradores antigos já estiverem inativos, a recuperação exige
manutenção autorizada e auditada de uma conta existente; não reabrir bootstrap
pela API. Usuários do aplicativo não são contas PostgreSQL de access_control.

## Falhas e limites

Emissão no banco e envio de e-mail não constituem uma transação distribuída.
Enviar depois do commit; falha de envio exige reenvio explícito com novo segredo.
Não foi acrescentada fila/outbox ou integração Gmail ao banco. A API precisa
implementar o envio, os endpoints, política de senha, proteção contra tentativas,
links, validação de endereço e mensagens apropriadas ao cliente.

Em 40001/40P01, fazer rollback integral e seguir política explícita de nova tentativa.
Não há retry oculto nas funções. Controles internos não substituem proteção das
credenciais técnicas. Não chamar a rotina de bootstrap com a conta da API.

## Validação

As regressões conferem permissões reais, bootstrap, aceite, reenvio, expiração,
revogação, autor inativo, e-mail ocupado, sessão revogada e ausência do hash no log.
Dois processos reais testam a proteção do último ADMIN e o consumo único sob
READ COMMITTED e REPEATABLE READ. A massa de desenvolvimento continua sendo fictícia.
A instalação completa, as regressões e a carga de demonstração foram verificadas
em PostgreSQL 16.15 descartável. A carga integrada mantém 112 usuários fictícios,
240 solicitações, 200 coletas, 400 entregas e 15 certificados.

Os testes permanecem em `../tests/admin_management_regression.sql` e
`../tests/admin_management_concurrency.py`, executados pelo CI via `run_ci.py`.
A remoção da ferramenta de migração não remove essas verificações de negócio.
Envio de e-mail, frontend e endpoints da Core exigem validação na aplicação.
