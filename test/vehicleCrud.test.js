const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const vehicleRepository = require("../src/repositories/vehicleRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: vehicleRepository.listByUserId,
  findVehicleById: vehicleRepository.findById,
  create: vehicleRepository.create,
  updateById: vehicleRepository.updateById,
  updateStatusById: vehicleRepository.updateStatusById,
  deleteById: vehicleRepository.deleteById,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  vehicleRepository.listByUserId = originalRepositories.listByUserId;
  vehicleRepository.findById = originalRepositories.findVehicleById;
  vehicleRepository.create = originalRepositories.create;
  vehicleRepository.updateById = originalRepositories.updateById;
  vehicleRepository.updateStatusById = originalRepositories.updateStatusById;
  vehicleRepository.deleteById = originalRepositories.deleteById;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "b4f95ecf-1a75-4370-bafc-f1ab73bf6345",
      nome: "Gestor Veiculos",
      matricula: "VEI2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "b4f95ecf-1a75-4370-bafc-f1ab73bf6345",
    nome: "Gestor Veiculos",
    matricula: "VEI2026",
    tipoUsuario: "operador",
    ativo: true,
  });
}

test.afterEach(() => {
  restoreRepositories();
});

test("lista veiculos autenticados", async () => {
  mockAuthenticatedUser();
  vehicleRepository.listByUserId = async () => [
    {
      id: "f217a4bd-3a9b-4695-bd9b-55f6c74f7498",
      placa: "ABC1D23",
      modelo: "Sprinter",
      tipo: "Van",
      capacidade: 1500,
      ano: 2024,
      status: "disponivel",
    },
  ];

  const response = await request(app)
    .get("/api/veiculos")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.totalVeiculos, 1);
  assert.equal(response.body.veiculos[0].placa, "ABC1D23");
});

test("cria veiculo com payload valido", async () => {
  mockAuthenticatedUser();
  vehicleRepository.create = async (_userId, payload) => ({
    id: "f217a4bd-3a9b-4695-bd9b-55f6c74f7498",
    ...payload,
  });

  const response = await request(app)
    .post("/api/veiculos")
    .set("Cookie", createCookie())
    .send({
      placa: "abc1d23",
      modelo: "Sprinter",
      tipo: "Van",
      capacidade: 1500,
      ano: 2024,
      status: "disponivel",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.veiculo.placa, "ABC1D23");
});

test("atualiza status do veiculo", async () => {
  mockAuthenticatedUser();
  vehicleRepository.updateStatusById = async (_userId, _id, status) => ({
    id: "f217a4bd-3a9b-4695-bd9b-55f6c74f7498",
    placa: "ABC1D23",
    modelo: "Sprinter",
    tipo: "Van",
    capacidade: 1500,
    ano: 2024,
    status,
  });

  const response = await request(app)
    .patch("/api/veiculos/f217a4bd-3a9b-4695-bd9b-55f6c74f7498/status")
    .set("Cookie", createCookie())
    .send({ status: "manutencao" });

  assert.equal(response.status, 200);
  assert.equal(response.body.veiculo.status, "manutencao");
});

test("exclui veiculo", async () => {
  mockAuthenticatedUser();
  vehicleRepository.deleteById = async () => ({ id: "f217a4bd-3a9b-4695-bd9b-55f6c74f7498" });

  const response = await request(app)
    .delete("/api/veiculos/f217a4bd-3a9b-4695-bd9b-55f6c74f7498")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.mensagem, "Veiculo excluido com sucesso");
});
