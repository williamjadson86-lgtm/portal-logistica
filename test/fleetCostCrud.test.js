const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const fleetCostRepository = require("../src/repositories/fleetCostRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: fleetCostRepository.listByUserId,
  listSupportData: fleetCostRepository.listSupportData,
  findExpenseById: fleetCostRepository.findById,
  create: fleetCostRepository.create,
  updateById: fleetCostRepository.updateById,
  deleteById: fleetCostRepository.deleteById,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  fleetCostRepository.listByUserId = originalRepositories.listByUserId;
  fleetCostRepository.listSupportData = originalRepositories.listSupportData;
  fleetCostRepository.findById = originalRepositories.findExpenseById;
  fleetCostRepository.create = originalRepositories.create;
  fleetCostRepository.updateById = originalRepositories.updateById;
  fleetCostRepository.deleteById = originalRepositories.deleteById;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "4d1ba6b1-dfc0-40d6-bb70-c3ef2db6c985",
      empresaId: "4a9b274d-fca4-4e17-bfd8-aabeb7834bf7",
      nome: "Gestor Frota",
      matricula: "FRO2026",
      tipoUsuario: "administrador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "4d1ba6b1-dfc0-40d6-bb70-c3ef2db6c985",
    empresaId: "4a9b274d-fca4-4e17-bfd8-aabeb7834bf7",
    nome: "Gestor Frota",
    matricula: "FRO2026",
    tipoUsuario: "administrador",
    ativo: true,
  });
}

function createExpense(overrides = {}) {
  return {
    id: "f9cceef1-ff33-4adf-8151-96020f9f481d",
    usuarioId: "4d1ba6b1-dfc0-40d6-bb70-c3ef2db6c985",
    empresaId: "4a9b274d-fca4-4e17-bfd8-aabeb7834bf7",
    veiculoId: "77a306c2-658d-473b-9631-e4a6416286fe",
    motoristaId: "87e851cc-dd6b-4685-a09d-77cc52ca6f4d",
    lancamentoFinanceiroId: "b9ef34bc-2c9a-4f54-a2a5-3319ca1a2792",
    integrarFinanceiro: true,
    tipo: "abastecimento",
    descricao: "Diesel rota capital",
    valor: 320.75,
    status: "pendente",
    dataDespesa: "2026-06-12",
    dataVencimento: "2026-06-15",
    dataPagamento: null,
    observacoes: "Posto parceiro",
    ativo: true,
    veiculo: {
      id: "77a306c2-658d-473b-9631-e4a6416286fe",
      placa: "ABC1D23",
      modelo: "Sprinter",
      status: "disponivel",
    },
    motorista: {
      id: "87e851cc-dd6b-4685-a09d-77cc52ca6f4d",
      nome: "Paulo Nunes",
      status: "ativo",
    },
    financeiro: {
      id: "b9ef34bc-2c9a-4f54-a2a5-3319ca1a2792",
      status: "pendente",
      dataCompetencia: "2026-06-12",
      dataVencimento: "2026-06-15",
      dataPagamento: null,
    },
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...overrides,
  };
}

test.afterEach(() => {
  restoreRepositories();
});

test("despesas de veiculos exigem autenticacao", async () => {
  const response = await request(app).get("/api/financeiro/despesas-veiculos");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("nova tela de custos da frota carrega autenticada", async () => {
  mockAuthenticatedUser();

  const response = await request(app).get("/custos-frota").set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.text, /Custos da Frota|Custos da frota/);
});

test("lista despesas da frota com resumo e apoio", async () => {
  mockAuthenticatedUser();
  fleetCostRepository.listByUserId = async () => [
    createExpense(),
    createExpense({
      id: "37e757ba-c7a2-49fc-9fe0-7fd23a3bf9ce",
      integrarFinanceiro: false,
      lancamentoFinanceiroId: null,
      financeiro: null,
      status: "pago",
      dataPagamento: "2026-06-13",
      valor: 180,
      tipo: "pedagio",
    }),
  ];
  fleetCostRepository.listSupportData = async () => ({
    veiculos: [{ id: "77a306c2-658d-473b-9631-e4a6416286fe", placa: "ABC1D23", modelo: "Sprinter", status: "disponivel" }],
    motoristas: [{ id: "87e851cc-dd6b-4685-a09d-77cc52ca6f4d", nome: "Paulo Nunes", status: "ativo" }],
  });

  const response = await request(app)
    .get("/api/financeiro/despesas-veiculos?tipo=abastecimento")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.despesas.length, 2);
  assert.equal(response.body.resumo.totalIntegradasFinanceiro, 1);
  assert.equal(response.body.resumo.totalControleInterno, 1);
  assert.equal(response.body.apoio.veiculos.length, 1);
});

test("rota dedicada lista despesas com filtros", async () => {
  mockAuthenticatedUser();
  let receivedFilters = null;
  fleetCostRepository.listByUserId = async (_user, filters) => {
    receivedFilters = filters;
    return [createExpense()];
  };
  fleetCostRepository.listSupportData = async () => ({ veiculos: [], motoristas: [] });

  const response = await request(app)
    .get("/api/custos-frota?veiculoId=77a306c2-658d-473b-9631-e4a6416286fe&tipo=abastecimento&dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilters.veiculoId, "77a306c2-658d-473b-9631-e4a6416286fe");
  assert.equal(receivedFilters.tipo, "abastecimento");
  assert.equal(receivedFilters.dataInicio, "2026-06-01");
  assert.equal(receivedFilters.dataFim, "2026-06-30");
});

test("cria despesa sem integracao financeira automatica", async () => {
  mockAuthenticatedUser();
  let receivedPayload = null;
  fleetCostRepository.create = async (_user, payload) => {
    receivedPayload = payload;
    return createExpense({
      integrarFinanceiro: false,
      lancamentoFinanceiroId: null,
      financeiro: null,
      status: "pendente",
      ...payload,
    });
  };

  const response = await request(app)
    .post("/api/financeiro/despesas-veiculos")
    .set("Cookie", createCookie())
    .send({
      veiculoId: "77a306c2-658d-473b-9631-e4a6416286fe",
      motoristaId: "87e851cc-dd6b-4685-a09d-77cc52ca6f4d",
      tipo: "manutencao",
      descricao: "Troca de oleo",
      valor: 450.9,
      status: "pendente",
      dataDespesa: "2026-06-12",
      integrarFinanceiro: false,
    });

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.integrarFinanceiro, false);
  assert.equal(response.body.despesa.integrarFinanceiro, false);
  assert.equal(response.body.despesa.lancamentoFinanceiroId, null);
});

test("atualiza despesa da frota existente", async () => {
  mockAuthenticatedUser();
  fleetCostRepository.updateById = async () =>
    createExpense({
      descricao: "Diesel rota interior",
      valor: 410.35,
      status: "pago",
      dataPagamento: "2026-06-14",
    });

  const response = await request(app)
    .patch("/api/financeiro/despesas-veiculos/f9cceef1-ff33-4adf-8151-96020f9f481d")
    .set("Cookie", createCookie())
    .send({
      descricao: "Diesel rota interior",
      valor: 410.35,
      status: "pago",
      dataPagamento: "2026-06-14",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.despesa.status, "pago");
  assert.equal(response.body.despesa.valor, 410.35);
});

test("cancela despesa da frota", async () => {
  mockAuthenticatedUser();
  fleetCostRepository.deleteById = async () =>
    createExpense({
      ativo: false,
      status: "cancelado",
    });

  const response = await request(app)
    .delete("/api/financeiro/despesas-veiculos/f9cceef1-ff33-4adf-8151-96020f9f481d")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.despesa.ativo, false);
  assert.equal(response.body.despesa.status, "cancelado");
});
