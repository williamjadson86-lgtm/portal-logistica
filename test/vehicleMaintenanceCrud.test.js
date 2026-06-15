const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const vehicleMaintenanceRepository = require("../src/repositories/vehicleMaintenanceRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: vehicleMaintenanceRepository.listByUserId,
  listSupportData: vehicleMaintenanceRepository.listSupportData,
  findByIdMaintenance: vehicleMaintenanceRepository.findById,
  create: vehicleMaintenanceRepository.create,
  updateById: vehicleMaintenanceRepository.updateById,
  deleteById: vehicleMaintenanceRepository.deleteById,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  vehicleMaintenanceRepository.listByUserId = originalRepositories.listByUserId;
  vehicleMaintenanceRepository.listSupportData = originalRepositories.listSupportData;
  vehicleMaintenanceRepository.findById = originalRepositories.findByIdMaintenance;
  vehicleMaintenanceRepository.create = originalRepositories.create;
  vehicleMaintenanceRepository.updateById = originalRepositories.updateById;
  vehicleMaintenanceRepository.deleteById = originalRepositories.deleteById;
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

function createMaintenance(overrides = {}) {
  return {
    id: "2d1ae4d5-3102-4637-b7a7-3cd0a7d1a46a",
    usuarioId: "4d1ba6b1-dfc0-40d6-bb70-c3ef2db6c985",
    empresaId: "4a9b274d-fca4-4e17-bfd8-aabeb7834bf7",
    veiculoId: "77a306c2-658d-473b-9631-e4a6416286fe",
    despesaVeiculoId: "f9cceef1-ff33-4adf-8151-96020f9f481d",
    tipo: "preventiva",
    descricao: "Revisao de 10 mil km",
    custo: 620.45,
    dataManutencao: "2026-06-12",
    proximaManutencao: "2026-09-12",
    status: "agendada",
    observacoes: "Troca de oleo e filtros",
    integrarFinanceiro: true,
    ativo: true,
    veiculo: {
      id: "77a306c2-658d-473b-9631-e4a6416286fe",
      placa: "ABC1D23",
      modelo: "Sprinter",
      status: "disponivel",
    },
    despesa: {
      id: "f9cceef1-ff33-4adf-8151-96020f9f481d",
      status: "pendente",
      valor: 620.45,
      dataDespesa: "2026-06-12",
      dataVencimento: null,
      dataPagamento: null,
      lancamentoFinanceiroId: "b9ef34bc-2c9a-4f54-a2a5-3319ca1a2792",
      integrarFinanceiro: true,
    },
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...overrides,
  };
}

test.afterEach(() => {
  restoreRepositories();
});

test("manutencoes de veiculos exigem autenticacao", async () => {
  const response = await request(app).get("/api/manutencoes-veiculos");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("nova tela de manutencoes carrega autenticada", async () => {
  mockAuthenticatedUser();

  const response = await request(app)
    .get("/manutencoes-veiculos")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.text, /Manutencoes|manutencao/i);
});

test("lista manutencoes com resumo e apoio", async () => {
  mockAuthenticatedUser();
  vehicleMaintenanceRepository.listByUserId = async () => [
    createMaintenance(),
    createMaintenance({
      id: "7a647c37-a437-4f64-a5f6-e8fe260c8548",
      custo: 480,
      status: "concluida",
      integrarFinanceiro: false,
      despesa: {
        id: "437cbdae-0f66-41c3-8eff-72f3cb64aa94",
        status: "pendente",
        valor: 480,
        dataDespesa: "2026-06-13",
        dataVencimento: null,
        dataPagamento: null,
        lancamentoFinanceiroId: null,
        integrarFinanceiro: false,
      },
    }),
  ];
  vehicleMaintenanceRepository.listSupportData = async () => ({
    veiculos: [
      { id: "77a306c2-658d-473b-9631-e4a6416286fe", placa: "ABC1D23", modelo: "Sprinter", status: "disponivel" },
    ],
  });

  const response = await request(app)
    .get("/api/manutencoes-veiculos?status=agendada")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.manutencoes.length, 2);
  assert.equal(response.body.resumo.totalRegistros, 2);
  assert.equal(response.body.resumo.totalIntegradasFinanceiro, 1);
  assert.equal(response.body.apoio.veiculos.length, 1);
});

test("cria manutencao com integracao financeira opcional", async () => {
  mockAuthenticatedUser();
  let receivedPayload = null;
  vehicleMaintenanceRepository.create = async (_user, payload) => {
    receivedPayload = payload;
    return createMaintenance({
      despesaVeiculoId: null,
      despesa: null,
      integrarFinanceiro: false,
      ...payload,
    });
  };

  const response = await request(app)
    .post("/api/manutencoes-veiculos")
    .set("Cookie", createCookie())
    .send({
      veiculoId: "77a306c2-658d-473b-9631-e4a6416286fe",
      tipo: "preventiva",
      descricao: "Troca de pneus",
      custo: 890.9,
      status: "agendada",
      dataManutencao: "2026-06-12",
      integrarFinanceiro: false,
    });

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.integrarFinanceiro, false);
  assert.equal(response.body.manutencao.integrarFinanceiro, false);
});

test("atualiza manutencao existente", async () => {
  mockAuthenticatedUser();
  vehicleMaintenanceRepository.updateById = async () =>
    createMaintenance({
      status: "em_execucao",
      custo: 910.2,
      descricao: "Revisao em andamento",
    });

  const response = await request(app)
    .patch("/api/manutencoes-veiculos/2d1ae4d5-3102-4637-b7a7-3cd0a7d1a46a")
    .set("Cookie", createCookie())
    .send({
      status: "em_execucao",
      custo: 910.2,
      descricao: "Revisao em andamento",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.manutencao.status, "em_execucao");
  assert.equal(response.body.manutencao.custo, 910.2);
});

test("cancela manutencao da frota", async () => {
  mockAuthenticatedUser();
  vehicleMaintenanceRepository.deleteById = async () =>
    createMaintenance({
      ativo: false,
      status: "cancelada",
    });

  const response = await request(app)
    .delete("/api/manutencoes-veiculos/2d1ae4d5-3102-4637-b7a7-3cd0a7d1a46a")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.manutencao.ativo, false);
  assert.equal(response.body.manutencao.status, "cancelada");
});
