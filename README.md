# Portal Logistica

Portal web inicial para colaboradores e parceiros de uma empresa de entregas logisticas, com login, cadastro, home protegida e autenticacao por JWT em cookie `HttpOnly`.

## Arquitetura

O projeto segue organizacao por camadas:

- `routes/`: definicao das rotas HTTP e das paginas
- `controllers/`: fluxo de autenticacao, portal e resposta das requisicoes
- `validations/`: validacao e normalizacao de dados de login e cadastro
- `repositories/`: acesso ao PostgreSQL com SQL parametrizado
- `middlewares/`: autenticacao e tratamento global de erros
- `views/` e `public/`: frontend em HTML, CSS e JavaScript puro

Fluxo principal:

```text
HTML/JS -> Rotas Express -> Controllers -> Validations -> Repositories -> PostgreSQL
```

## Stack

- Node.js 20+
- Express 5
- PostgreSQL
- HTML, CSS e JavaScript
- `bcryptjs` para hash de senha
- `jsonwebtoken` para sessao

## Estrutura

```text
database/
  init.sql
public/
  css/
  img/
  js/
scripts/
  dbInit.js
src/
  config/
  controllers/
  errors/
  middlewares/
  repositories/
  routes/
  validations/
  app.js
  server.js
test/
  authFlow.test.js
  userValidation.test.js
views/
  login.html
  cadastro.html
  home.html
```

## O que ja funciona

- Cadastro de usuario com persistencia prevista em PostgreSQL
- Login por matricula e senha
- Senha armazenada como hash com `bcryptjs`
- JWT assinado no backend
- Cookie `HttpOnly` enviado no login e no cadastro
- Home protegida por middleware de autenticacao
- Logout com limpeza do cookie
- Validacao basica no frontend e validacao definitiva no backend

## Pre-requisitos no Windows

1. Instale o Node.js 20 ou superior.
2. Instale o PostgreSQL localmente.
3. Durante a instalacao do PostgreSQL, anote:
   - usuario administrador, normalmente `postgres`
   - senha definida para esse usuario
   - porta, normalmente `5432`
4. Garanta que o `psql` esteja disponivel no terminal:

```powershell
psql --version
```

Se o comando nao for reconhecido, adicione o `bin` do PostgreSQL ao `PATH`.

Exemplo comum:

```text
C:\Program Files\PostgreSQL\17\bin
```

## Instalacao do projeto

1. Instale as dependencias:

```powershell
npm install
```

2. Copie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

3. Ajuste o `DATABASE_URL` no `.env` com a senha real do seu PostgreSQL local.

Exemplo:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/portal_logistica
DATABASE_SSL=false
JWT_SECRET=troque-esta-chave-antes-de-publicar
JWT_EXPIRES_IN=8h
COOKIE_NAME=portal_logistica_token
```

## Criacao do banco local

### Opcao 1: via `psql`

Crie o banco:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE portal_logistica;"
```

Depois execute o schema:

```powershell
psql -U postgres -h localhost -p 5432 -d portal_logistica -f database/init.sql
```

### Opcao 2: via pgAdmin

1. Abra o pgAdmin.
2. Crie um banco chamado `portal_logistica`.
3. Abra o Query Tool desse banco.
4. Cole o conteudo de `database/init.sql`.
5. Execute o script.

### Opcao 3: via npm

Se o banco `portal_logistica` ja existir e o `.env` estiver correto:

```powershell
npm run db:init
```

Esse comando executa o arquivo `database/init.sql` usando a conexao configurada em `DATABASE_URL`.

## Scripts npm

- `npm run db:init`: executa o schema em `database/init.sql`
- `npm run dev`: inicia a aplicacao em modo watch
- `npm start`: inicia a aplicacao normalmente
- `npm test`: roda os testes automatizados

## Como iniciar

```powershell
npm run dev
```

A aplicacao ficara disponivel em:

```text
http://localhost:3000
```

## Rotas principais

### Paginas

- `GET /`
- `GET /login`
- `GET /cadastro`
- `GET /home`

### API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `GET /api/portal/cards`
- `GET /health`

## Roteiro de teste manual

1. Abra `http://localhost:3000/login`.
2. Clique em `Primeiro acesso / Cadastre-se`.
3. Preencha o formulario de cadastro com:
   - nome completo
   - CPF valido
   - e-mail nao utilizado
   - telefone
   - matricula/codigo unico
   - senha e confirmacao
   - tipo de usuario
4. Envie o cadastro e confirme:
   - resposta de sucesso
   - redirecionamento para `/home`
5. Saia pelo botao `Sair`.
6. Tente acessar `http://localhost:3000/home` sem login e confirme redirecionamento para `/login`.
7. Volte para `/login`.
8. Informe matricula e senha do usuario criado.
9. Confirme:
   - login bem-sucedido
   - acesso a `/home`
   - cards do portal carregados
10. Clique em `Sair` e valide o retorno ao login.

## Verificacoes tecnicas da primeira versao

As checagens abaixo ja foram revisadas no projeto:

- nomes dos campos do frontend batem com o backend:
  - `nome`
  - `cpf`
  - `email`
  - `telefone`
  - `matricula`
  - `senha`
  - `confirmacaoSenha`
  - `tipoUsuario`
- login usa `matricula` e `senha`
- cadastro normaliza `email` e `matricula`
- login gera JWT com `sub`, `nome`, `matricula` e `tipoUsuario`
- cookie de sessao e enviado com `HttpOnly` e `SameSite=Lax`
- `/home` redireciona para `/login` sem autenticacao
- `/api/portal/cards` responde `401` sem autenticacao

## Testes automatizados

Rode:

```powershell
npm test
```

A suite cobre:

- validacao de CPF e cadastro
- validacao de login
- cadastro com envio correto dos campos ao backend
- emissao de cookie `HttpOnly`
- geracao de JWT no login
- protecao da home
- protecao da API interna do portal

## Observacoes

- Nao ha necessidade de CORS nesta primeira versao porque frontend e backend rodam na mesma origem.
- Se o PostgreSQL estiver ativo e o `.env` correto, o fluxo completo funciona sem Docker.
