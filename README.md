# Olius — Banco de Dados

Repositório responsável pela camada de dados do projeto **Olius**, reunindo a modelagem, estruturas, scripts e configurações dos bancos de dados utilizados pelo sistema.

O projeto utiliza diferentes tecnologias de armazenamento, cada uma destinada a necessidades específicas da aplicação:

* **PostgreSQL** — Banco de dados relacional principal.
* **MongoDB** — Banco de dados orientado a documentos.
* **Redis** — Armazenamento em memória para dados temporários e operações de alta velocidade.
* **Neo4j** — Banco de dados orientado a grafos.

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
