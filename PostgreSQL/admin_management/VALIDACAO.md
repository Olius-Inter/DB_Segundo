# Validação da entrega administrativa

Validado em 20/10/2026, em PostgreSQL 16.15 descartável e isolado, sem conexão com produção.

- Instalação completa dos scripts principais, catálogo e controle de acesso: passou.
- Regressões de negócio, sessões, API, catálogo, Data Mart e administração: passaram.
- Duas conexões simultâneas: somente um aceite por convite e preservação do último ADMIN ativo, em READ COMMITTED e REPEATABLE READ.
- Convites: bootstrap restrito, prazo de 24 horas, uso único, reenvio, revogação, autor inativo e e-mail ocupado verificados.
- Permissões: API sem bootstrap, helper privado, escrita direta administrativa ou leitura de hash; auditoria sem hash do convite.
- Falha fechada: ausência da linha técnica de coordenação bloqueia a operação.
- Atualização de banco antigo populado: executada em transação; usuários, coletas, entregas, cálculos de pontos e quantidade de logs de usuários permaneceram iguais.
- Carga completa após instalação nova: 112 usuários, 240 solicitações, 200 coletas, 400 entregas e 15 certificados; nenhuma conta ou convite real criado.
- Gerador da atualização: três testes passaram, cobertura Python de 96%.
- Runner da carga: 19 testes passaram; um teste de symlink ignorado no Windows; cobertura de 96%.

O fluxo de CI passa a executar as regressões administrativas e os testes do gerador, incluindo seu relatório de cobertura. A execução remota do GitHub/Sonar ainda dependerá do envio da branch; estes resultados não representam aprovação remota do Quality Gate.

A validação não executou envio de e-mail, frontend ou endpoints da Core. Esses componentes seguem o contrato descrito no README e devem ser implementados/testados pela API.
