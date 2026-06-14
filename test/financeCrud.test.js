const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const financeRepository = require("../src/repositories/financeRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: financeRepository.listByUserId,
  listSupportData: financeRepository.listSupportData,
  findFinanceById: financeRepository.findById,
  create: financeRepository.create,
  updateById: financeRepository.updateById,
  updateStatusById: financeRepository.updateStatusById,
  cancelById: financeRepository.cancelById,
  createFromDelivery: financeRepository.createFromDelivery,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  financeRepository.listByUserId = originalRepositories.listByUserId;
  financeRepository.listSupportData = originalRepositories.listSupportData;
  financeRepository.findById = originalRepositories.findFinanceById;
  financeRepository.create = originalRepositories.create;
  financeRepository.updateById = originalRepositories.updateById;
  financeRepository.updateStatusById = originalRepositories.updateStatusById;
  financeRepository.cancelById = originalRepositories.cancelById;
  financeRepository.createFromDelivery = originalRepositories.createFromDelivery;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "a417cb16-9d5d-4b55-a4a0-6bbbc33f3f4f",
      nome: "Financeiro Teste",
      matricula: "FIN2026",
      tipoUsuario: "administrador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function createFinanceEntry(overrides = {}) {
  return {
    id: "271168da-7442-4f70-9b79-6b67dca4cc79",
    usuarioId: "a417cb16-9d5d-4b55-a4a0-6bbbc33f3f4f",
    clienteId: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
    entregaId: "fedacdb3-bd12-4b9d-97ad-d94436fa17d9",
    tipo: "receita",
    descricao: "Frete da entrega ENT-001",
    valor: 420.5,
    status: "pendente",
    dataCompetencia: "2026-06-10",
    dataVencimento: "2026-06-15",
    dataPagamento: null,
    observacoes: "Aguardando faturamento",
    cliente: {
      id: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
      nome: "Acme Logistica",
      documento: "12345678000190",
      status: "ativo",
    },
    entrega: {
      id: "fedacdb3-bd12-4b9d-97ad-d94436fa17d9",
      codigo: "ENT-001",
      cliente: "Acme Logistica",
      status: "entregue",
      valorFrete: 420.5,
    },
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...overrides,
  };
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "a417cb16-9d5d-4b55-a4a0-6bbbc33f3f4f",
    nome: "Financeiro Teste",
    matricula: "FIN2026",
    tipoUsuario: "administrador",
    ativo: true,
  });
  financeRepository.listSupportData = async () => ({
    clientes: [
      {
        id: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
        nome: "Acme Logistica",
        documento: "12345678000190",
        status: "ativo",
      },
    ],
    entregas: [
      {
        id: "fedacdb3-bd12-4b9d-97ad-d94436fa17d9",
        clienteId: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
        codigo: "ENT-001",
        cliente: "Acme Logistica",
        status: "entregue",
        dataPrevista: "2026-06-10",
        valorFrete: 420.5,
        temLancamentoAtivo: false,
      },
    ],
  });
}

test.afterEach(() => {
  restoreRepositories();
});

test("financeiro exige autenticacao", async () => {
  const response = await request(app).get("/api/financeiro");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("lista lancamentos com resumo e apoio", async () => {
  mockAuthenticatedUser();
  financeRepository.listByUserId = async () => [
    createFinanceEntry(),
    createFinanceEntry({
      id: "98a342fc-7778-4eb6-b1d9-cfabaa38c8de",
      status: "pago",
      valor: 300,
      dataPagamento: "2026-06-11",
    }),
  ];

  const response = await request(app)
    .get("/api/financeiro?status=pendente")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.lancamentos.length, 2);
  assert.equal(response.body.resumo.totalLancamentos, 2);
  assert.equal(response.body.apoio.clientes[0].nome, "Acme Logistica");
});

test("cria lancamento manual com cliente vinculado", async () => {
  mockAuthenticatedUser();
  financeRepository.create = async (_userId, payload) =>
    createFinanceEntry({
      id: "2d7798b8-af68-4910-9bf4-bfbde85b6ed1",
      entregaId: null,
      entrega: null,
      ...payload,
    });

  const response = await request(app)
    .post("/api/financeiro")
    .set("Cookie", createCookie())
    .send({
      clienteId: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
      tipo: "receita",
      descricao: "Faturamento mensal do cliente Acme",
      valor: 950.8,
      status: "faturado",
      dataCompetencia: "2026-06-10",
      dataVencimento: "2026-06-20",
      observacoes: "Lote junho",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.lancamento.clienteId, "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d");
  assert.equal(response.body.lancamento.entregaId, null);
});

test("cria lancamento com entrega vinculada", async () => {
  mockAuthenticatedUser();
  financeRepository.create = async (_userId, payload) =>
    createFinanceEntry({
      id: "4e38c1f6-c1a9-4a56-bad0-585315dc3c0e",
      ...payload,
    });

  const response = await request(app)
    .post("/api/financeiro")
    .set("Cookie", createCookie())
    .send({
      clienteId: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
      entregaId: "fedacdb3-bd12-4b9d-97ad-d94436fa17d9",
      tipo: "receita",
      descricao: "Frete da entrega ENT-001",
      valor: 420.5,
      status: "pendente",
      dataCompetencia: "2026-06-10",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.lancamento.entregaId, "fedacdb3-bd12-4b9d-97ad-d94436fa17d9");
});

test("bloqueia lancamento duplicado por entrega", async () => {
  mockAuthenticatedUser();
  financeRepository.create = async () => {
    const error = new Error("duplicate");
    error.code = "23505";
    error.constraint = "idx_financeiro_entrega_ativa_unique";
    throw error;
  };

  const response = await request(app)
    .post("/api/financeiro")
    .set("Cookie", createCookie())
    .send({
      entregaId: "fedacdb3-bd12-4b9d-97ad-d94436fa17d9",
      tipo: "receita",
      descricao: "Frete duplicado",
      valor: 420.5,
      status: "pendente",
      dataCompetencia: "2026-06-10",
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.erro, "Ja existe lancamento financeiro ativo para esta entrega");
});

test("atualiza dados do lancamento", async () => {
  mockAuthenticatedUser();
  financeRepository.updateById = async () =>
    createFinanceEntry({
      descricao: "Frete reajustado",
      valor: 500,
      observacoes: "Valor corrigido",
    });

  const response = await request(app)
    .patch("/api/financeiro/271168da-7442-4f70-9b79-6b67dca4cc79")
    .set("Cookie", createCookie())
    .send({
      descricao: "Frete reajustado",
      valor: 500,
      observacoes: "Valor corrigido",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.lancamento.valor, 500);
});

test("altera status do lancamento", async () => {
  mockAuthenticatedUser();
  financeRepository.updateStatusById = async (_userId, _id, status, dataPagamento) =>
    createFinanceEntry({
      status,
      dataPagamento: dataPagamento || "2026-06-11",
    });

  const response = await request(app)
    .patch("/api/financeiro/271168da-7442-4f70-9b79-6b67dca4cc79/status")
    .set("Cookie", createCookie())
    .send({
      status: "pago",
      dataPagamento: "2026-06-11",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.lancamento.status, "pago");
  assert.equal(response.body.lancamento.dataPagamento, "2026-06-11");
});

test("cancela lancamento de forma logica", async () => {
  mockAuthenticatedUser();
  financeRepository.cancelById = async () =>
    createFinanceEntry({
      status: "cancelado",
      dataPagamento: null,
    });

  const response = await request(app)
    .delete("/api/financeiro/271168da-7442-4f70-9b79-6b67dca4cc79")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.lancamento.status, "cancelado");
});

test("gera lancamento a partir de entrega concluida", async () => {
  mockAuthenticatedUser();
  financeRepository.createFromDelivery = async (_userId, deliveryId, payload) =>
    createFinanceEntry({
      id: "9bb1bc7a-5d80-4308-b27a-0bb6a4a67645",
      entregaId: deliveryId,
      clienteId: "e66612f5-37f5-4f6a-b8fb-c6cbf8d2f74d",
      descricao: payload.descricao,
      valor: payload.valor,
      dataCompetencia: payload.dataCompetencia,
      dataVencimento: payload.dataVencimento,
      observacoes: payload.observacoes,
    });

  const response = await request(app)
    .post("/api/entregas/fedacdb3-bd12-4b9d-97ad-d94436fa17d9/lancamento-financeiro")
    .set("Cookie", createCookie())
    .send({
      tipo: "receita",
      descricao: "Frete da entrega ENT-001",
      valor: 420.5,
      dataCompetencia: "2026-06-10",
      dataVencimento: "2026-06-15",
      observacoes: "Gerado pelo modulo financeiro",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.lancamento.entregaId, "fedacdb3-bd12-4b9d-97ad-d94436fa17d9");
});
