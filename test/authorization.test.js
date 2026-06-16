const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const app = require("../src/app");
const userRepository = require("../src/repositories/userRepository");
const deliveryRepository = require("../src/repositories/deliveryRepository");
const routePlanningRepository = require("../src/repositories/routePlanningRepository");

const originalRepository = {
  findById: userRepository.findById,
  getDashboardSummaryForUser: deliveryRepository.getDashboardSummaryForUser,
  getRouteDashboardSummaryForUser: routePlanningRepository.getDashboardSummaryForUser,
};

function createCookie(tipoUsuario) {
  const token = jwt.sign(
    {
      sub: `user-${tipoUsuario}`,
      nome: `Perfil ${tipoUsuario}`,
      matricula: `MAT-${tipoUsuario}`.toUpperCase(),
      tipoUsuario,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockUser(tipoUsuario) {
  userRepository.findById = async (id) => ({
    id,
    nome: `Perfil ${tipoUsuario}`,
    cpf: "529.982.247-25",
    email: `${tipoUsuario}@empresa.com`,
    telefone: "(11) 99999-9999",
    matricula: `MAT-${tipoUsuario}`.toUpperCase(),
    tipoUsuario,
    ativo: true,
  });
}

function restoreRepository() {
  userRepository.findById = originalRepository.findById;
  deliveryRepository.getDashboardSummaryForUser =
    originalRepository.getDashboardSummaryForUser;
  routePlanningRepository.getDashboardSummaryForUser =
    originalRepository.getRouteDashboardSummaryForUser;
}

test.afterEach(() => {
  restoreRepository();
});

test("colaborador recebe 403 na API de clientes e redirecionamento amigavel no HTML", async () => {
  mockUser("colaborador");

  const [apiResponse, htmlResponse] = await Promise.all([
    request(app).get("/api/clientes").set("Cookie", createCookie("colaborador")),
    request(app).get("/clientes").set("Cookie", createCookie("colaborador")),
  ]);

  assert.equal(apiResponse.status, 403);
  assert.equal(apiResponse.body.erro, "Acesso negado para o perfil atual");
  assert.equal(htmlResponse.status, 302);
  assert.match(htmlResponse.headers.location, /^\/acesso-negado/);
});

test("operador acessa entregas mas nao acessa financeiro", async () => {
  mockUser("operador");

  const [deliveriesPage, financeApi] = await Promise.all([
    request(app).get("/entregas").set("Cookie", createCookie("operador")),
    request(app).get("/api/financeiro").set("Cookie", createCookie("operador")),
  ]);

  assert.equal(deliveriesPage.status, 200);
  assert.equal(financeApi.status, 403);
});

test("motorista pode abrir comprovantes mas nao pode criar entregas", async () => {
  mockUser("motorista");

  const [proofPage, createDelivery] = await Promise.all([
    request(app).get("/comprovantes").set("Cookie", createCookie("motorista")),
    request(app).post("/api/entregas").set("Cookie", createCookie("motorista")).send({}),
  ]);

  assert.equal(proofPage.status, 200);
  assert.equal(createDelivery.status, 403);
});

test("financeiro acessa financeiro e relatorios, mas nao motoristas", async () => {
  mockUser("financeiro");

  const [financePage, reportsPage, fleetPage, driversApi] = await Promise.all([
    request(app).get("/financeiro").set("Cookie", createCookie("financeiro")),
    request(app).get("/relatorios").set("Cookie", createCookie("financeiro")),
    request(app).get("/despesas-veiculos").set("Cookie", createCookie("financeiro")),
    request(app).get("/api/motoristas").set("Cookie", createCookie("financeiro")),
  ]);

  assert.equal(financePage.status, 200);
  assert.equal(reportsPage.status, 200);
  assert.equal(fleetPage.status, 200);
  assert.equal(driversApi.status, 403);
});

test("colaborador nao acessa custos da frota e operador acessa o modulo", async () => {
  mockUser("colaborador");
  const [deniedResponse, deniedApiResponse, deniedMaintenancePage, deniedMaintenanceApi] = await Promise.all([
    request(app).get("/despesas-veiculos").set("Cookie", createCookie("colaborador")),
    request(app).get("/api/despesas-veiculos").set("Cookie", createCookie("colaborador")),
    request(app).get("/manutencoes-veiculos").set("Cookie", createCookie("colaborador")),
    request(app).get("/api/manutencoes-veiculos").set("Cookie", createCookie("colaborador")),
  ]);

  assert.equal(deniedResponse.status, 302);
  assert.match(deniedResponse.headers.location, /^\/acesso-negado/);
  assert.equal(deniedApiResponse.status, 403);
  assert.equal(deniedMaintenancePage.status, 302);
  assert.match(deniedMaintenancePage.headers.location, /^\/acesso-negado/);
  assert.equal(deniedMaintenanceApi.status, 403);

  mockUser("operador");
  const [allowedResponse, allowedMaintenanceResponse] = await Promise.all([
    request(app).get("/despesas-veiculos").set("Cookie", createCookie("operador")),
    request(app).get("/manutencoes-veiculos").set("Cookie", createCookie("operador")),
  ]);

  assert.equal(allowedResponse.status, 200);
  assert.equal(allowedMaintenanceResponse.status, 200);
});

test("administrador mantem acesso total e visualiza todos os cards da home", async () => {
  mockUser("administrador");
  deliveryRepository.getDashboardSummaryForUser = async () => ({
    total: 1,
    emTransito: 0,
    entregues: 1,
    pendentes: 0,
  });
  routePlanningRepository.getDashboardSummaryForUser = async () => ({
    total: 1,
    planejadas: 1,
    emAndamento: 0,
    concluidas: 0,
  });

  const response = await request(app)
    .get("/api/portal/cards")
    .set("Cookie", createCookie("administrador"));

  assert.equal(response.status, 200);
  assert.equal(response.body.cards.length, 15);
  assert.ok(response.body.cards.some((card) => card.href === "/despesas-veiculos"));
  assert.ok(response.body.cards.some((card) => card.href === "/manutencoes-veiculos"));
});
