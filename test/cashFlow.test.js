const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const financeRepository = require("../src/repositories/financeRepository");
const fleetCostRepository = require("../src/repositories/fleetCostRepository");
const app = require("../src/app");

function binaryParser(response, callback) {
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
}

const originalRepositories = {
  findById: userRepository.findById,
  getCashFlowData: financeRepository.getCashFlowData,
  updateStatusById: financeRepository.updateStatusById,
  updateFleetExpense: fleetCostRepository.updateById,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  financeRepository.getCashFlowData = originalRepositories.getCashFlowData;
  financeRepository.updateStatusById = originalRepositories.updateStatusById;
  fleetCostRepository.updateById = originalRepositories.updateFleetExpense;
}

function createCookie(tipoUsuario = "financeiro") {
  const token = jwt.sign(
    {
      sub: "7ed4b22d-c9d6-4a17-ad52-00b3598a7adf",
      nome: "Caixa Teste",
      matricula: "CASH2026",
      tipoUsuario,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser(tipoUsuario = "financeiro") {
  userRepository.findById = async () => ({
    id: "7ed4b22d-c9d6-4a17-ad52-00b3598a7adf",
    nome: "Caixa Teste",
    matricula: "CASH2026",
    tipoUsuario,
    ativo: true,
  });
}

function createCashFlowReport() {
  return {
    filtros: {
      periodo: "7d",
      dataInicio: "2026-06-09",
      dataFim: "2026-06-15",
      hoje: "2026-06-15",
    },
    fluxoCaixa: {
      saldoAtual: 4200,
      receitasPrevistas: 1200,
      receitasRecebidas: 800,
      despesasPrevistas: 600,
      despesasPagas: 350,
      saldoProjetado: 4800,
    },
    contasReceber: {
      resumo: {
        totalReceber: 1200,
        vencidos: 200,
        proximosVencimentos: 700,
        recebidos: 800,
      },
      itens: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          descricao: "Frete da entrega ENT-010",
          status: "pendente",
          valor: 500,
          dataCompetencia: "2026-06-10",
          dataVencimento: "2026-06-15",
          dataPagamento: null,
          cliente: { nome: "Acme" },
          entrega: { codigo: "ENT-010" },
        },
      ],
    },
    contasPagar: {
      resumo: {
        totalPagar: 600,
        vencidos: 100,
        proximosVencimentos: 300,
        pagos: 350,
      },
      itens: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          origem: "financeiro",
          descricao: "Seguro da operacao",
          status: "pendente",
          valor: 300,
          dataCompetencia: "2026-06-10",
          dataVencimento: "2026-06-16",
          dataPagamento: null,
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          origem: "frota",
          descricao: "Abastecimento da rota urbana",
          status: "pendente",
          valor: 300,
          dataCompetencia: "2026-06-10",
          dataVencimento: "2026-06-16",
          dataPagamento: null,
        },
      ],
    },
    dashboardFinanceiro: {
      faturamentoMes: 8500,
      despesasMes: 2300,
      lucroLiquido: 6200,
      margemOperacional: 72.94,
      saldoProjetado: 4800,
      contasVencidas: 2,
      fluxoCaixaAcumulado: 5100,
    },
    graficos: {
      receitaPorPeriodo: [{ data: "2026-06-10", valor: 300 }],
      despesaPorPeriodo: [{ data: "2026-06-10", valor: 100 }],
      lucroPorPeriodo: [{ data: "2026-06-10", valor: 200 }],
      fluxoAcumulado: [{ data: "2026-06-10", valor: 4200 }],
    },
    indicadoresEstrategicos: {
      ticketMedioPorCliente: 900,
      receitaPorEntrega: 420.5,
      custoPorEntrega: 120.2,
      lucroPorEntrega: 300.3,
      receitaPorVeiculo: 1800,
      custoPorVeiculo: 520,
      lucroPorVeiculo: 1280,
    },
  };
}

test.afterEach(() => {
  restoreRepositories();
});

test("fluxo de caixa exige autenticacao", async () => {
  const response = await request(app).get("/api/fluxo-caixa");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("tela de fluxo de caixa carrega para perfil financeiro", async () => {
  mockAuthenticatedUser();

  const response = await request(app).get("/fluxo-caixa").set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.text, /Fluxo de Caixa|Fluxo de caixa/);
});

test("retorna fluxo de caixa consolidado com filtros", async () => {
  mockAuthenticatedUser();
  let receivedFilters = null;
  financeRepository.getCashFlowData = async (_user, filters) => {
    receivedFilters = filters;
    return createCashFlowReport();
  };

  const response = await request(app)
    .get("/api/fluxo-caixa?periodo=custom&dataInicio=2026-06-01&dataFim=2026-06-15")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilters.periodo, "custom");
  assert.equal(receivedFilters.dataInicio, "2026-06-01");
  assert.equal(response.body.fluxoCaixa.saldoProjetado, 4800);
  assert.equal(response.body.dashboardFinanceiro.fluxoCaixaAcumulado, 5100);
});

test("marca conta a receber como recebida", async () => {
  mockAuthenticatedUser();
  financeRepository.updateStatusById = async (_user, id, status, dataPagamento) => ({
    id,
    status,
    dataPagamento,
  });

  const response = await request(app)
    .patch("/api/fluxo-caixa/receber/11111111-1111-4111-8111-111111111111")
    .set("Cookie", createCookie())
    .send({ dataPagamento: "2026-06-15" });

  assert.equal(response.status, 200);
  assert.equal(response.body.lancamento.status, "pago");
  assert.equal(response.body.lancamento.dataPagamento, "2026-06-15");
});

test("marca conta a pagar financeira como paga", async () => {
  mockAuthenticatedUser();
  financeRepository.updateStatusById = async (_user, id, status, dataPagamento) => ({
    id,
    status,
    dataPagamento,
  });

  const response = await request(app)
    .patch("/api/fluxo-caixa/pagar/financeiro/22222222-2222-4222-8222-222222222222")
    .set("Cookie", createCookie())
    .send({ dataPagamento: "2026-06-15" });

  assert.equal(response.status, 200);
  assert.equal(response.body.lancamento.status, "pago");
});

test("marca despesa de frota como paga", async () => {
  mockAuthenticatedUser();
  fleetCostRepository.updateById = async (_user, id, payload) => ({
    id,
    status: payload.status,
    dataPagamento: payload.dataPagamento,
  });

  const response = await request(app)
    .patch("/api/fluxo-caixa/pagar/frota/33333333-3333-4333-8333-333333333333")
    .set("Cookie", createCookie())
    .send({ dataPagamento: "2026-06-15" });

  assert.equal(response.status, 200);
  assert.equal(response.body.despesa.status, "pago");
});

test("exporta fluxo de caixa em csv", async () => {
  mockAuthenticatedUser();
  financeRepository.getCashFlowData = async () => createCashFlowReport();

  const response = await request(app)
    .get("/api/fluxo-caixa/export.csv?periodo=7d")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/csv/);
  assert.match(response.text, /saldo atual/i);
});

test("exporta contas a receber em xlsx", async () => {
  mockAuthenticatedUser();
  financeRepository.getCashFlowData = async () => createCashFlowReport();

  const response = await request(app)
    .get("/api/fluxo-caixa/receber/export.xlsx?periodo=7d")
    .buffer(true)
    .parse(binaryParser)
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(
    response.headers["content-type"],
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  assert.ok(response.body.length > 0);
  assert.equal(response.body[0], 0x50);
  assert.equal(response.body[1], 0x4b);
});

test("exporta contas a pagar em csv", async () => {
  mockAuthenticatedUser();
  financeRepository.getCashFlowData = async () => createCashFlowReport();

  const response = await request(app)
    .get("/api/fluxo-caixa/pagar/export.csv?periodo=7d")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/csv/);
  assert.match(response.text, /origem,descricao,status/i);
});
