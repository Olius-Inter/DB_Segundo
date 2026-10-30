# Passo a Passo - Backup e Recuperação
Esse arquivo mostra um passo a passo para criar um arquivo de backup de um banco de dados local e em nuvem, além de utilizar um banco vazio para recuperar o banco que foi feito o backup.

## Banco Local
1. **Fazer o backup**

    No CLI do PowerShell, dentro do diretório desejado, rode o seguinte comando:

    ```powershell
    pg_dump -h <nome_servidor> -p <porta> -U <usuário_admin> -W -d <nome_banco> --format=plain --file=<nome_arquivo.sql>
    ```

    O arquivo `nome_arquivo.sql` será salvo na pasta atual, contendo a estrutura e os registros do banco.

2. **Banco novo vazio**

    O comando a seguir conecta o banco local e executa o SQL para criar um banco com template vazio:

    ```powershell
    psql -h <nome_servidor> -p <porta> -U <usuário_admin> -W -d <banco_admin> -c "CREATE DATABASE <nome_banco_vazio> WITH TEMPLATE template0;"
    ```

3. **Recuperar o backup**

    O script `.sql` vai preencher o banco vazio com a estrutura e os dados do backup:

    ```powershell
    psql -X -h <nome_servidor> -p <porta> -U <usuário_admin> -W -d <nome_banco_vazio> --set=ON_ERROR_STOP=on --single-transaction --file="nome_arquivo.sql"
    ```

Após recuperar as informações do banco antigo, compare o antigo com o novo para ver se os registros batem.

## Banco em nuvem
1. **Fazer o backup**

    No CLI do PowerShell, dentro do diretório desejado, rode o seguinte comando:

    ```powershell
    pg_dump --dbname="host=<HOST> port=<PORTA> user=<ADMIN> dbname=<DATABASE_NAME> sslmode=require" -W --format=plain --file="nome_arquivo.sql"
    ```

    O comando essa o banco na nuvem e salva a estrutura e os dados no `nome_arquivo.sql` localmente na máquina.

2. **Banco novo vazio**

    O comando cria um novo banco na *Cloud* usando um template vazio:

    ```powershell
    psql --dbname="host=<HOST> port=<PORTA> user=<ADMIN> dbname=<DATABASE_NAME> sslmode=require" -W -c "CREATE DATABASE banco_novo_vazio WITH TEMPLATE template0;"
    ```

3. **Recuperar o backup**

    O script `.sql` vai preencher o banco vazio com a estrutura e os dados do backup:

    ```powershell
    psql --dbname="host=<HOST> port=<PORTA> user=<ADMIN> dbname=<DATABASE_NAME> sslmode=require" -X -W --set=ON_ERROR_STOP=on --single-transaction --file="nome_arquivo.sql"
    ```

Após recuperar as informações do banco antigo, compare o antigo com o novo para ver se os registros batem.