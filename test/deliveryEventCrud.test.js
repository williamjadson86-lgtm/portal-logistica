const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const deliveryRepository = require("../src/repositories/deliveryRepository");
const deliveryEventRepository = require("../src/repositories/deliveryEventRepository");
const app = require("../src/app");

const originalRepositories = {
  findUserById: userRepository.findById,
  findDeliveryById: deliveryRepository.findById,
  listEventsByDeliveryId: deliveryEventRepository.listByDeliveryId,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findUserById;
  deliveryRepository.findById = originalRepositories.findDeliveryById;
  deliveryEventRepository.listByDeliveryId = originalRepositories.listEventsByDeliveryId;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "c2d85a4d-7828-4f89-939b-90f9999f4dd5",
      nome: "Timeline Tester",
      matricula: "TML2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "c2d85a4d-7828-4f89-939b-90f9999f4dd5",
    nome: "Timeline Tester",
    matricula: "TML2026",
    tipoUsuario: "operador",
    ativo: true,
  });
}

test.afterEach(() => {
  restoreRepositories();
});

test("listagem da timeline da entrega retorna eventos autenticada", async () => {
  mockAuthenticatedUser();
  deliveryRepository.findById = async () => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
    codigo: "ENT-100",
    cliente: "Acme",
    origem: "Centro",
    destino: "Zona Sul",
    cidade: "Sao Paulo",
    estado: "SP",
    status: "em_rota",
    dataPrevista: "2026-06-10",
    observacoes: "",
  });
  deliveryEventRepository.listByDeliveryId = async () => [
    {
      id: "evt-1",
      entregaId: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
      usuarioId: "c2d85a4d-7828-4f89-939b-90f9999f4dd5",
      usuarioNome: "Timeline Tester",
      tipoEvento: "comprovante_enviado",
      descricao: "Comprovante foto enviado para a entrega ENT-100",
      dados: { comprovanteId: "proof-1" },
      criadoEm: "2026-06-09T14:30:00.000Z",
    },
  ];

  const response = await request(app)
    .get("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7/eventos")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.eventos.length, 1);
  assert.equal(response.body.eventos[0].tipoEvento, "comprovante_enviado");
});

test("timeline da entrega exige autenticacao", async () => {
  const response = await request(app).get(
    "/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7/eventos",
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});
