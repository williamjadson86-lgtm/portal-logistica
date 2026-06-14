const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const routePlanningRepository = require("../src/repositories/routePlanningRepository");
const deliveryEventRepository = require("../src/repositories/deliveryEventRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listForUser: routePlanningRepository.listForUser,
  getDashboardSummaryForUser: routePlanningRepository.getDashboardSummaryForUser,
  getSupportDataForUser: routePlanningRepository.getSupportDataForUser,
  findRouteByIdForUser: routePlanningRepository.findByIdForUser,
  create: routePlanningRepository.create,
  updateById: routePlanningRepository.updateById,
  deleteById: routePlanningRepository.deleteById,
  addDeliveries: routePlanningRepository.addDeliveries,
  removeDelivery: routePlanningRepository.removeDelivery,
  startRoute: routePlanningRepository.startRoute,
  completeRoute: routePlanningRepository.completeRoute,
  cancelRoute: routePlanningRepository.cancelRoute,
  appendMany: deliveryEventRepository.appendMany,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  routePlanningRepository.listForUser = originalRepositories.listForUser;
  routePlanningRepository.getDashboardSummaryForUser =
    originalRepositories.getDashboardSummaryForUser;
  routePlanningRepository.getSupportDataForUser =
    originalRepositories.getSupportDataForUser;
  routePlanningRepository.findByIdForUser = originalRepositories.findRouteByIdForUser;
  routePlanningRepository.create = originalRepositories.create;
  routePlanningRepository.updateById = originalRepositories.updateById;
  routePlanningRepository.deleteById = originalRepositories.deleteById;
  routePlanningRepository.addDeliveries = originalRepositories.addDeliveries;
  routePlanningRepository.removeDelivery = originalRepositories.removeDelivery;
  routePlanningRepository.startRoute = originalRepositories.startRoute;
  routePlanningRepository.completeRoute = originalRepositories.completeRoute;
  routePlanningRepository.cancelRoute = originalRepositories.cancelRoute;
  deliveryEventRepository.appendMany = originalRepositories.appendMany;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "2bcd454f-fd15-4db8-a203-ea17688df00c",
      nome: "Planejador",
      matricula: "ROT2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "2bcd454f-fd15-4db8-a203-ea17688df00c",
    nome: "Planejador",
    matricula: "ROT2026",
    tipoUsuario: "operador",
    ativo: true,
  });
  deliveryEventRepository.appendMany = async (events) => events;
}

function createSupport() {
  return {
    motoristas: [{ id: "0bc4b0e8-6e1e-4231-9297-aa5e067645c1", nome: "Carlos Mendes" }],
    veiculos: [
      {
        id: "9dc81cb0-398a-419d-917e-51081f2b45ae",
        placa: "ABC1D23",
        modelo: "Sprinter",
      },
    ],
    entregasDisponiveis: [
      {
        id: "e0cc8d12-9a98-4f4f-bb95-05e58df41d1d",
        codigo: "ENT-100",
        cliente: "Acme",
        status: "pendente",
        dataPrevista: "2026-06-20",
      },
    ],
  };
}

function createRoute(overrides = {}) {
  return {
    id: "e2471252-cd69-4033-a2be-3c5091cdb261",
    codigo: "ROT-001",
    motoristaId: "0bc4b0e8-6e1e-4231-9297-aa5e067645c1",
    motoristaNome: "Carlos Mendes",
    veiculoId: "9dc81cb0-398a-419d-917e-51081f2b45ae",
    veiculoPlaca: "ABC1D23",
    origem: "Centro",
    destino: "Zona Sul",
    dataRota: "2026-06-20",
    status: "planejada",
    observacoes: "",
    totalEntregasAtivas: 1,
    totalEntregasHistorico: 1,
    entregas: [
      {
        relacaoId: "51a4127e-76fe-431c-a51b-e3e7fdcf7f2a",
        id: "e0cc8d12-9a98-4f4f-bb95-05e58df41d1d",
        codigo: "ENT-100",
        cliente: "Acme",
        origem: "Centro",
        destino: "Zona Sul",
        cidade: "Sao Paulo",
        estado: "SP",
        status: "pendente",
        dataPrevista: "2026-06-20",
        observacoes: "",
        ativo: true,
      },
    ],
    ...overrides,
  };
}

test.afterEach(() => {
  restoreRepositories();
});

test("lista rotas autenticadas", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.listForUser = async () => [createRoute()];
  routePlanningRepository.getDashboardSummaryForUser = async () => ({
    total: 1,
    planejadas: 1,
    emAndamento: 0,
    concluidas: 0,
  });
  routePlanningRepository.getSupportDataForUser = async () => createSupport();

  const response = await request(app)
    .get("/api/rotas")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.totalRotas, 1);
  assert.equal(response.body.rotas[0].codigo, "ROT-001");
});

test("cria rota com payload valido", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.create = async () => ({
    rota: createRoute(),
    apoio: createSupport(),
  });

  const response = await request(app)
    .post("/api/rotas")
    .set("Cookie", createCookie())
    .send({
      codigo: "rot-001",
      motoristaId: "0bc4b0e8-6e1e-4231-9297-aa5e067645c1",
      veiculoId: "9dc81cb0-398a-419d-917e-51081f2b45ae",
      origem: "Centro",
      destino: "Zona Sul",
      dataRota: "2026-06-20",
      observacoes: "Primeira rota",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.rota.codigo, "ROT-001");
});

test("visualiza detalhes da rota", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.findByIdForUser = async () => createRoute();
  routePlanningRepository.getSupportDataForUser = async () => createSupport();

  const response = await request(app)
    .get("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.rota.entregas[0].codigo, "ENT-100");
});

test("vincula entregas a rota", async () => {
  mockAuthenticatedUser();
  let capturedEvents = [];
  routePlanningRepository.addDeliveries = async () => ({
    rota: createRoute({ totalEntregasAtivas: 2 }),
    apoio: createSupport(),
  });
  deliveryEventRepository.appendMany = async (events) => {
    capturedEvents = events;
    return events;
  };

  const response = await request(app)
    .post("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261/entregas")
    .set("Cookie", createCookie())
    .send({
      entregaIds: ["e0cc8d12-9a98-4f4f-bb95-05e58df41d1d"],
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.rota.totalEntregasAtivas, 2);
  assert.equal(capturedEvents[0].tipoEvento, "vinculada_rota");
});

test("bloqueia entrega ja vinculada", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.addDeliveries = async () => {
    throw Object.assign(new Error("Entrega ENT-100 ja esta vinculada a uma rota ativa"), {
      status: 409,
    });
  };

  const response = await request(app)
    .post("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261/entregas")
    .set("Cookie", createCookie())
    .send({
      entregaIds: ["e0cc8d12-9a98-4f4f-bb95-05e58df41d1d"],
    });

  assert.equal(response.status, 409);
  assert.match(response.body.erro, /ja esta vinculada/);
});

test("inicia rota atualizando entregas para em_rota", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.startRoute = async () => ({
    rota: createRoute({
      status: "em_andamento",
      entregas: [createRoute().entregas[0], { ...createRoute().entregas[0], status: "em_rota" }],
    }),
    apoio: createSupport(),
  });

  const response = await request(app)
    .patch("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261/iniciar")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.rota.status, "em_andamento");
});

test("conclui rota atualizando entregas para entregue", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.completeRoute = async () => ({
    rota: createRoute({
      status: "concluida",
      entregas: [{ ...createRoute().entregas[0], status: "entregue", ativo: false }],
    }),
    apoio: createSupport(),
  });

  const response = await request(app)
    .patch("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261/concluir")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.rota.status, "concluida");
  assert.equal(response.body.rota.entregas[0].status, "entregue");
});

test("cancela rota operacional", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.cancelRoute = async () => ({
    rota: createRoute({ status: "cancelada" }),
    apoio: createSupport(),
  });

  const response = await request(app)
    .patch("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261/cancelar")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.rota.status, "cancelada");
});

test("exclui rota planejada", async () => {
  mockAuthenticatedUser();
  routePlanningRepository.deleteById = async () => ({
    id: "e2471252-cd69-4033-a2be-3c5091cdb261",
  });

  const response = await request(app)
    .delete("/api/rotas/e2471252-cd69-4033-a2be-3c5091cdb261")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.mensagem, "Rota excluida com sucesso");
});
