const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const clientRepository = require("../src/repositories/clientRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: clientRepository.listByUserId,
  findClientById: clientRepository.findById,
  create: clientRepository.create,
  updateById: clientRepository.updateById,
  updateStatusById: clientRepository.updateStatusById,
  deleteById: clientRepository.deleteById,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  clientRepository.listByUserId = originalRepositories.listByUserId;
  clientRepository.findById = originalRepositories.findClientById;
  clientRepository.create = originalRepositories.create;
  clientRepository.updateById = originalRepositories.updateById;
  clientRepository.updateStatusById = originalRepositories.updateStatusById;
  clientRepository.deleteById = originalRepositories.deleteById;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "9c88d4b4-5e6f-4f2f-a224-e5109f55d106",
      nome: "Gestor Clientes",
      matricula: "CLI2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "9c88d4b4-5e6f-4f2f-a224-e5109f55d106",
    nome: "Gestor Clientes",
    matricula: "CLI2026",
    tipoUsuario: "operador",
    ativo: true,
  });
}

test.afterEach(() => {
  restoreRepositories();
});

test("lista clientes autenticados", async () => {
  mockAuthenticatedUser();
  clientRepository.listByUserId = async () => [
    {
      id: "c47f787d-3b10-411b-b2f4-5e5d5cb5915c",
      nome: "Acme Logistica",
      documento: "12.345.678/0001-90",
      email: "contato@acme.com",
      telefone: "(11) 90000-0000",
      contatoNome: "Marcia",
      cidade: "Sao Paulo",
      estado: "SP",
      endereco: "Av. Paulista, 100",
      status: "ativo",
      observacoes: "",
    },
  ];

  const response = await request(app)
    .get("/api/clientes")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.totalClientes, 1);
  assert.equal(response.body.clientes[0].nome, "Acme Logistica");
});

test("cria cliente com payload valido", async () => {
  mockAuthenticatedUser();
  clientRepository.create = async (_userId, payload) => ({
    id: "c47f787d-3b10-411b-b2f4-5e5d5cb5915c",
    ...payload,
  });

  const response = await request(app)
    .post("/api/clientes")
    .set("Cookie", createCookie())
    .send({
      nome: "Acme Logistica",
      documento: "12345678000190",
      email: "CONTATO@ACME.COM",
      telefone: "(11) 90000-0000",
      contatoNome: "Marcia",
      cidade: "Sao Paulo",
      estado: "sp",
      endereco: "Av. Paulista, 100",
      status: "ativo",
      observacoes: "Cliente prioritario",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.cliente.estado, "SP");
  assert.equal(response.body.cliente.email, "contato@acme.com");
});

test("atualiza status do cliente", async () => {
  mockAuthenticatedUser();
  clientRepository.updateStatusById = async (_userId, _id, status) => ({
    id: "c47f787d-3b10-411b-b2f4-5e5d5cb5915c",
    nome: "Acme Logistica",
    documento: "12.345.678/0001-90",
    email: "contato@acme.com",
    telefone: "(11) 90000-0000",
    contatoNome: "Marcia",
    cidade: "Sao Paulo",
    estado: "SP",
    endereco: "Av. Paulista, 100",
    status,
    observacoes: "",
  });

  const response = await request(app)
    .patch("/api/clientes/c47f787d-3b10-411b-b2f4-5e5d5cb5915c/status")
    .set("Cookie", createCookie())
    .send({ status: "bloqueado" });

  assert.equal(response.status, 200);
  assert.equal(response.body.cliente.status, "bloqueado");
});

test("exclui cliente", async () => {
  mockAuthenticatedUser();
  clientRepository.deleteById = async () => ({ id: "c47f787d-3b10-411b-b2f4-5e5d5cb5915c" });

  const response = await request(app)
    .delete("/api/clientes/c47f787d-3b10-411b-b2f4-5e5d5cb5915c")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.mensagem, "Cliente excluido com sucesso");
});
