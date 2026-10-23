# Olius — Banco de Dados

Repositório responsável pela camada de dados do projeto **Olius**, reunindo a modelagem, estruturas, scripts e configurações dos bancos de dados utilizados pelo sistema.

O projeto utiliza diferentes tecnologias de armazenamento, cada uma destinada a necessidades específicas da aplicação:

* **PostgreSQL** — Banco de dados relacional principal.
* **MongoDB** — Banco de dados orientado a documentos.
* **Redis** — Armazenamento em memória para dados temporários e operações de alta velocidade.
* **Neo4j** — Banco de dados orientado a grafos.

## Cargas de dados

- [Configuração inicial oficial](PostgreSQL/initial_data/README.md): 16 registros de planos, níveis de certificados, tipos de estabelecimento e motivos de falha. Compartilhada entre produção e desenvolvimento.
- [Data Load de demonstração](PostgreSQL/data_load/README.md): reutiliza a configuração oficial e cria dados fictícios exclusivamente em desenvolvimento/testes. Não executar em produção.

## Data Mart e BI

O recorte analítico de coletas, entregas e solicitações usa views materializadas
em star schema no PostgreSQL. O ranking aprovado também é materializado.
Os dashboards consultam diretamente o schema dm por conexão federada no
Databricks. Um Job Python separado chama a procedure de refresh no PostgreSQL,
com a conta restrita de atualização; não há cópia dos dados para Delta.

* **PostgreSQL/08_materialized_views.sql** — instalação das fatos, dimensões e ranking.
* **PostgreSQL/09_refresh_materialized_views.sql** — refresh manual coordenado.
* **Databricks/** — notebook de refresh, seus testes e guias de configuração/execução.
* [Guia do Data Mart](Databricks/documents/README.md) — conexão, sequência de execução, modelo e atualização.

---

# 📌 Boas Práticas

* Manter cada tecnologia em seu respectivo diretório;
* Evitar armazenar credenciais diretamente no repositório;
* Utilizar variáveis de ambiente para configurações sensíveis;
* Versionar alterações estruturais do banco;
* Criar migrations/scripts de alteração quando necessário;
* Documentar alterações relevantes;
* Utilizar nomes consistentes para tabelas, coleções, chaves e relacionamentos;
* Evitar duplicação desnecessária de dados entre tecnologias;
* Validar alterações de estrutura antes de integrá-las à branch principal.

---

# 👥 Desenvolvimento

Este repositório faz parte do projeto **Olius** e é utilizado em conjunto com os demais componentes da aplicação.

Alterações na estrutura ou nas regras de persistência devem ser avaliadas considerando seus impactos na **API, aplicação e demais serviços que utilizam os bancos de dados**.

---

## 📄 Licença

Este projeto é destinado a fins acadêmicos e de desenvolvimento do projeto Olius.
