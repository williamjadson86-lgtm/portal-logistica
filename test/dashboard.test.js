const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const dashboardRepository = require("../src/repositories/dashboardRepository");
const { validateDashboardQuery } = require("../src/validations/dashboardValidation");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  getOperationalDashboard: dashboardRepository.getOperationalDashboard,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  dashboardRepository.getOperationalDashboard = originalRepositories.getOperationalDashboard;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "326309c0-1c40-45bf-8fb1-3fd2fc1782e3",
      nome: "Analista Dashboard",
      matricula: "DASH2026",
      tipoUsuario: "administrador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "326309c0-1c40-45bf-8fb1-3fd2fc1782e3",
    nome: "Analista Dashboard",
    matricula: "DASH2026",
    tipoUsuario: "administrador",
    ativo: true,
  });
}

function createDashboardPayload(filter = { periodo: "7d", dataInicio: "2026-06-03", dataFim: "2026-06-09" }) {
  return {
    filtro: filter,
    metricas: {
      totalEntregas: 12,
      entregasPendentes: 3,
      entregasEmTransito: 2,
      entregasEmRota: 1,
      entregasEntregues: 6,
      rotasPlanejadas: 4,
      rotasEmAndamento: 2,
      rotasConcluidas: 3,
      motoristasAtivos: 5,
      veiculosDisponiveis: 4,
      veiculosEmRota: 2,
      veiculosEmManutencao: 1,
      manutencoesProgramadas: 4,
      receitaTotalPeriodo: 8900.5,
      totalDespesasFrotaPeriodo: 2400.25,
      despesasPendentesFrotaPeriodo: 1700.1,
      despesasPagasFrotaPeriodo: 700.15,
      custoManutencaoPeriodo: 700.35,
      lucroOperacionalPeriodo: 6500.25,
      resultadoLiquidoPeriodo: 6500.25,
      margemOperacionalPeriodo: 73.03,
      valoresPendentes: 2100.75,
      valoresPagos: 6400.25,
      lancamentosVencidos: 2,
    },
    alertas: {
      entregasPendentesVencidas: 2,
      rotasPlanejadasHoje: 1,
      veiculosEmManutencao: 1,
      motoristasInativos: 1,
      entregasEntreguesSemComprovante: 2,
      entregasSemRota: 3,
      rotasEmAndamento: 2,
      lancamentosVencidos: 2,
      despesasFrotaVencidas: 1,
      manutencoesVencidas: 1,
    },
    produtividade: {
      entregasConcluidasPeriodo: 6,
      percentualConclusao: 50,
      mediaEntregasPorRota: 2.5,
      rotasConcluidasPeriodo: 3,
      entregasSemRota: 3,
      totalComprovantesPeriodo: 5,
      entregasEntreguesSemComprovante: 2,
      manutencoesConcluidasPeriodo: 2,
      receitaTotalPeriodo: 8900.5,
      totalDespesasFrotaPeriodo: 2400.25,
      despesasPendentesFrotaPeriodo: 1700.1,
      despesasPagasFrotaPeriodo: 700.15,
      custoManutencaoPeriodo: 700.35,
      lucroOperacionalPeriodo: 6500.25,
      resultadoLiquidoPeriodo: 6500.25,
      margemOperacionalPeriodo: 73.03,
      valoresPendentes: 2100.75,
      valoresPagos: 6400.25,
      lancamentosVencidos: 2,
      despesasFrotaVencidas: 1,
    },
    frota: {
      custoTotalFrotaPeriodo: 2400.25,
      despesasPendentesFrotaPeriodo: 1700.1,
      despesasPagasFrotaPeriodo: 700.15,
      custoManutencaoPeriodo: 700.35,
      custoMedioPorVeiculo: 800.08,
      custoMedioPorMotorista: 1200.13,
      despesasPorVeiculo: [
        { veiculoId: "v1", placa: "ABC1D23", modelo: "Sprinter", custoTotal: 1200.1 },
      ],
      despesasPorTipo: [
        { tipo: "abastecimento", valor: 1200.1 },
        { tipo: "manutencao", valor: 700.35 },
      ],
      veiculosMaiorDespesa: [
        { veiculoId: "v1", placa: "ABC1D23", modelo: "Sprinter", custoTotal: 1200.1 },
      ],
      motoristasMaiorDespesa: [
        { motoristaId: "m1", nome: "Paulo Nunes", custoTotal: 1200.1 },
      ],
      manutencoesVencidas: 1,
      lucroLiquidoPeriodo: 6500.25,
      margemOperacionalPeriodo: 73.03,
    },
  };
}

test.afterEach(() => {
  restoreRepositories();
});

test("dashboard exige autenticacao", async () => {
  const response = await request(app).get("/api/dashboard");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("dashboard retorna metricas e alertas autenticado", async () => {
  mockAuthenticatedUser();
  dashboardRepository.getOperationalDashboard = async () => createDashboardPayload();

  const response = await request(app)
    .get("/api/dashboard?periodo=7d")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.metricas.totalEntregas, 12);
  assert.equal(response.body.alertas.entregasSemRota, 3);
  assert.equal(response.body.alertas.entregasEntreguesSemComprovante, 2);
  assert.equal(response.body.alertas.manutencoesVencidas, 1);
  assert.equal(response.body.produtividade.mediaEntregasPorRota, 2.5);
  assert.equal(response.body.produtividade.manutencoesConcluidasPeriodo, 2);
  assert.equal(response.body.produtividade.totalComprovantesPeriodo, 5);
  assert.equal(response.body.metricas.receitaTotalPeriodo, 8900.5);
  assert.equal(response.body.metricas.custoManutencaoPeriodo, 700.35);
  assert.equal(response.body.metricas.despesasPendentesFrotaPeriodo, 1700.1);
  assert.equal(response.body.metricas.despesasPagasFrotaPeriodo, 700.15);
  assert.equal(response.body.metricas.lancamentosVencidos, 2);
  assert.equal(response.body.frota.veiculosMaiorDespesa[0].placa, "ABC1D23");
  assert.equal(response.body.frota.despesasPorTipo[0].tipo, "abastecimento");
});

test("dashboard aplica filtro customizado", async () => {
  mockAuthenticatedUser();
  let receivedFilter;
  dashboardRepository.getOperationalDashboard = async (_userId, filter) => {
    receivedFilter = filter;
    return createDashboardPayload(filter);
  };

  const response = await request(app)
    .get("/api/dashboard?periodo=custom&dataInicio=2026-06-01&dataFim=2026-06-15")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilter.periodo, "custom");
  assert.equal(receivedFilter.dataInicio, "2026-06-01");
  assert.equal(receivedFilter.dataFim, "2026-06-15");
});

test("dashboard valida periodo customizado invalido", async () => {
  mockAuthenticatedUser();

  const response = await request(app)
    .get("/api/dashboard?periodo=custom&dataInicio=2026-06-20&dataFim=2026-06-10")
    .set("Cookie", createCookie());

  assert.equal(response.status, 400);
  assert.equal(response.body.erro, "Dados invalidos");
  assert.match(response.body.detalhes[0], /dataInicio/);
});

test("dashboard usa intervalo relativo de 7 dias por padrao", async () => {
  const { errors, data } = validateDashboardQuery({}, new Date("2026-06-09T10:00:00Z"));

  assert.deepEqual(errors, []);
  assert.equal(data.periodo, "7d");
  assert.equal(data.dataInicio, "2026-06-03");
  assert.equal(data.dataFim, "2026-06-09");
});

test("dashboard preserva consistencia basica do resumo", async () => {
  mockAuthenticatedUser();
  dashboardRepository.getOperationalDashboard = async () =>
    createDashboardPayload({
      periodo: "hoje",
      dataInicio: "2026-06-09",
      dataFim: "2026-06-09",
    });

  const response = await request(app)
    .get("/api/dashboard?periodo=hoje")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.produtividade.percentualConclusao, 50);
  assert.equal(response.body.metricas.rotasEmAndamento, response.body.alertas.rotasEmAndamento);
  assert.equal(
    response.body.produtividade.receitaTotalPeriodo,
    response.body.metricas.receitaTotalPeriodo,
  );
});
