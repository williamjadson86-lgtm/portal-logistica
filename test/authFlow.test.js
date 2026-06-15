const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const repository = require("../src/repositories/userRepository");
const deliveryRepository = require("../src/repositories/deliveryRepository");
const routePlanningRepository = require("../src/repositories/routePlanningRepository");
const app = require("../src/app");

const originalRepository = {
  create: repository.create,
  findByEmail: repository.findByEmail,
  findByMatricula: repository.findByMatricula,
  findById: repository.findById,
  getDashboardSummaryForUser: deliveryRepository.getDashboardSummaryForUser,
  getRouteDashboardSummaryForUser: routePlanningRepository.getDashboardSummaryForUser,
};

function restoreRepository() {
  repository.create = originalRepository.create;
  repository.findByEmail = originalRepository.findByEmail;
  repository.findByMatricula = originalRepository.findByMatricula;
  repository.findById = originalRepository.findById;
  deliveryRepository.getDashboardSummaryForUser =
    originalRepository.getDashboardSummaryForUser;
  routePlanningRepository.getDashboardSummaryForUser =
    originalRepository.getRouteDashboardSummaryForUser;
}

test.afterEach(() => {
  restoreRepository();
});

test("cadastro envia os campos esperados e retorna cookie HttpOnly", async () => {
  let receivedPayload;

  repository.findByEmail = async () => null;
  repository.findByMatricula = async () => null;
  repository.create = async (payload) => {
    receivedPayload = payload;
    return {
      id: "8e1f7c7c-8a1d-43a9-b7c4-52f6b5a96ff1",
      empresaId: "empresa-001",
      nome: payload.nome,
      cpf: payload.cpf,
      email: payload.email,
      telefone: payload.telefone,
      matricula: payload.matricula,
      tipoUsuario: payload.tipoUsuario,
      ativo: true,
    };
  };

  const response = await request(app).post("/api/auth/register").send({
    nome: "Maria da Silva",
    cpf: "529.982.247-25",
    email: "maria@empresa.com",
    telefone: "(11) 99999-9999",
    matricula: "col1234",
    senha: "123456",
    confirmacaoSenha: "123456",
    tipoUsuario: "colaborador",
  });

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.nome, "Maria da Silva");
  assert.equal(receivedPayload.email, "maria@empresa.com");
  assert.equal(receivedPayload.matricula, "COL1234");
  assert.match(receivedPayload.senhaHash, /^\$2[aby]\$/);
  assert.ok(Array.isArray(response.headers["set-cookie"]));
  assert.match(response.headers["set-cookie"][0], new RegExp(`^${env.cookieName}=`));
  assert.match(response.headers["set-cookie"][0], /HttpOnly/i);
  assert.match(response.headers["set-cookie"][0], /SameSite=Lax/i);
});

test("paginas publicas principais respondem com sucesso", async () => {
  const loginResponse = await request(app).get("/login");
  const registerResponse = await request(app).get("/cadastro");

  assert.equal(loginResponse.status, 200);
  assert.match(loginResponse.text, /Entrar no portal/);
  assert.equal(registerResponse.status, 200);
  assert.match(registerResponse.text, /Criar acesso/);
});

test("login gera JWT valido e envia cookie HttpOnly", async () => {
  const senhaHash = await bcrypt.hash("123456", 10);

  repository.findByMatricula = async () => ({
    id: "97c9345d-e2db-4f8d-8610-a189f8f8d738",
    empresaId: "empresa-002",
    nome: "Carlos Souza",
    matricula: "COL4321",
    tipoUsuario: "operador",
    senhaHash,
    ativo: true,
  });

  const response = await request(app).post("/api/auth/login").send({
    matricula: "col4321",
    senha: "123456",
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.headers["set-cookie"]));
  assert.match(response.headers["set-cookie"][0], /HttpOnly/i);

  const cookieValue = response.headers["set-cookie"][0]
    .split(";")[0]
    .split("=")[1];
  const payload = jwt.verify(cookieValue, env.jwtSecret);

  assert.equal(payload.sub, "97c9345d-e2db-4f8d-8610-a189f8f8d738");
  assert.equal(payload.userId, "97c9345d-e2db-4f8d-8610-a189f8f8d738");
  assert.equal(payload.matricula, "COL4321");
  assert.equal(payload.tipoUsuario, "operador");
  assert.equal(payload.empresaId, "empresa-002");
});

test("home redireciona para login sem autenticacao", async () => {
  const response = await request(app).get("/home");

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, "/login");
});

test("api do portal exige autenticacao", async () => {
  const response = await request(app).get("/api/portal/cards");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("home autenticada carrega e api do portal retorna usuario autenticado", async () => {
  const token = jwt.sign(
    {
      sub: "bbf6e8c9-f903-4f9a-a15d-5fbb63f5a6d0",
      empresaId: "empresa-003",
      nome: "Ana Lima",
      matricula: "ADM1000",
      tipoUsuario: "administrador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  repository.findById = async () => ({
    id: "bbf6e8c9-f903-4f9a-a15d-5fbb63f5a6d0",
    empresaId: "empresa-003",
    nome: "Ana Lima",
    cpf: "529.982.247-25",
    email: "ana@empresa.com",
    telefone: "(11) 99999-9999",
    matricula: "ADM1000",
    tipoUsuario: "administrador",
    ativo: true,
  });
  deliveryRepository.getDashboardSummaryForUser = async () => ({
    total: 3,
    emTransito: 1,
    entregues: 1,
    pendentes: 1,
  });
  routePlanningRepository.getDashboardSummaryForUser = async () => ({
    total: 2,
    planejadas: 1,
    emAndamento: 1,
    concluidas: 0,
  });

  const homeResponse = await request(app)
    .get("/home")
    .set("Cookie", `${env.cookieName}=${token}`);
  const apiResponse = await request(app)
    .get("/api/portal/cards")
    .set("Cookie", `${env.cookieName}=${token}`);

  assert.equal(homeResponse.status, 200);
  assert.match(homeResponse.text, /Portal Logistica \| Home/);
  assert.equal(apiResponse.status, 200);
  assert.equal(apiResponse.body.usuario.nome, "Ana Lima");
  assert.equal(apiResponse.body.usuario.empresaId, "empresa-003");
  assert.equal(apiResponse.body.dashboard.totalEntregas, 3);
  assert.equal(apiResponse.body.dashboard.entregasEntregues, 1);
  assert.equal(apiResponse.body.rotas.rotasEmAndamento, 1);
  assert.equal(apiResponse.body.cards.length, 15);
  assert.ok(apiResponse.body.cards.some((card) => card.href === "/custos-frota"));
  assert.ok(apiResponse.body.cards.some((card) => card.href === "/manutencoes-veiculos"));
});
