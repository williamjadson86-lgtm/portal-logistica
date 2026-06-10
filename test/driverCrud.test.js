const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const driverRepository = require("../src/repositories/driverRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: driverRepository.listByUserId,
  findDriverById: driverRepository.findById,
  create: driverRepository.create,
  updateById: driverRepository.updateById,
  updateStatusById: driverRepository.updateStatusById,
  deleteById: driverRepository.deleteById,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  driverRepository.listByUserId = originalRepositories.listByUserId;
  driverRepository.findById = originalRepositories.findDriverById;
  driverRepository.create = originalRepositories.create;
  driverRepository.updateById = originalRepositories.updateById;
  driverRepository.updateStatusById = originalRepositories.updateStatusById;
  driverRepository.deleteById = originalRepositories.deleteById;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "a3d39c31-a8c1-4b3a-89b7-cf16d932e12a",
      nome: "Gestor Frota",
      matricula: "FRO2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "a3d39c31-a8c1-4b3a-89b7-cf16d932e12a",
    nome: "Gestor Frota",
    matricula: "FRO2026",
    tipoUsuario: "operador",
    ativo: true,
  });
}

test.afterEach(() => {
  restoreRepositories();
});

test("lista motoristas autenticados", async () => {
  mockAuthenticatedUser();
  driverRepository.listByUserId = async () => [
    {
      id: "f5c5cd4a-a63e-4407-a403-a84cfb35f3a4",
      nome: "Carlos Mendes",
      cpf: "123.456.789-09",
      cnh: "SP7654321",
      categoriaCnh: "D",
      validadeCnh: "2027-10-10",
      telefone: "(11) 98888-0000",
      status: "ativo",
    },
  ];

  const response = await request(app)
    .get("/api/motoristas")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.totalMotoristas, 1);
  assert.equal(response.body.motoristas[0].nome, "Carlos Mendes");
});

test("cria motorista com payload valido", async () => {
  mockAuthenticatedUser();
  driverRepository.create = async (_userId, payload) => ({
    id: "f5c5cd4a-a63e-4407-a403-a84cfb35f3a4",
    ...payload,
  });

  const response = await request(app)
    .post("/api/motoristas")
    .set("Cookie", createCookie())
    .send({
      nome: "Carlos Mendes",
      cpf: "529.982.247-25",
      cnh: "sp7654321",
      categoriaCnh: "d",
      validadeCnh: "2027-10-10",
      telefone: "(11) 98888-0000",
      status: "ativo",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.motorista.categoriaCnh, "D");
});

test("atualiza status do motorista", async () => {
  mockAuthenticatedUser();
  driverRepository.updateStatusById = async (_userId, _id, status) => ({
    id: "f5c5cd4a-a63e-4407-a403-a84cfb35f3a4",
    nome: "Carlos Mendes",
    cpf: "123.456.789-09",
    cnh: "SP7654321",
    categoriaCnh: "D",
    validadeCnh: "2027-10-10",
    telefone: "(11) 98888-0000",
    status,
  });

  const response = await request(app)
    .patch("/api/motoristas/f5c5cd4a-a63e-4407-a403-a84cfb35f3a4/status")
    .set("Cookie", createCookie())
    .send({ status: "afastado" });

  assert.equal(response.status, 200);
  assert.equal(response.body.motorista.status, "afastado");
});

test("exclui motorista", async () => {
  mockAuthenticatedUser();
  driverRepository.deleteById = async () => ({ id: "f5c5cd4a-a63e-4407-a403-a84cfb35f3a4" });

  const response = await request(app)
    .delete("/api/motoristas/f5c5cd4a-a63e-4407-a403-a84cfb35f3a4")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.mensagem, "Motorista excluido com sucesso");
});
