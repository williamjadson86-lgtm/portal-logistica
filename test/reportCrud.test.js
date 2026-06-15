const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const reportRepository = require("../src/repositories/reportRepository");
const app = require("../src/app");

function binaryParser(response, callback) {
  const chunks = [];

  response.on("data", (chunk) => chunks.push(chunk));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
}

const originalRepositories = {
  findById: userRepository.findById,
  listByClient: reportRepository.listByClient,
  getClientReportDetails: reportRepository.getClientReportDetails,
  getFleetCostReport: reportRepository.getFleetCostReport,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  reportRepository.listByClient = originalRepositories.listByClient;
  reportRepository.getClientReportDetails = originalRepositories.getClientReportDetails;
  reportRepository.getFleetCostReport = originalRepositories.getFleetCostReport;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "2f8bd540-72c6-4139-8ce4-7205d95ef2cb",
      nome: "Gestor Relatorios",
      matricula: "REP2026",
      tipoUsuario: "administrador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "2f8bd540-72c6-4139-8ce4-7205d95ef2cb",
    nome: "Gestor Relatorios",
    matricula: "REP2026",
    tipoUsuario: "administrador",
    ativo: true,
  });
}

function createClientRow(overrides = {}) {
  return {
    clienteId: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
    nome: "Acme Logistica",
    documento: "12.345.678/0001-90",
    status: "ativo",
    totalEntregas: 4,
    entregasPendentes: 1,
    entregasEmRota: 1,
    entregasEntregues: 2,
    entregasCanceladas: 0,
    totalRotasVinculadas: 2,
    totalComprovantes: 3,
    receitaTotal: 1200.5,
    valorPendente: 350.5,
    valorPago: 850,
    lancamentosVencidos: 1,
    ticketMedioPorEntrega: 300.13,
    ...overrides,
  };
}

function createFleetReport() {
  return {
    resumo: {
      totalEntregasRentaveis: 8,
      totalVeiculosComMovimento: 2,
      totalMotoristasComMovimento: 2,
      receitaTotal: 5400,
      despesaTotal: 1900,
      lucroOperacional: 3500,
      resultadoLiquido: 3500,
      margemOperacional: 64.81,
      lancamentosVencidos: 1,
      custosPorTipo: {
        abastecimento: 900,
        manutencao: 1000,
      },
    },
    veiculos: [
      {
        veiculoId: "f46bde49-cf4f-4e56-8f32-bd4426cf4f93",
        placa: "ABC1D23",
        modelo: "Sprinter",
        status: "disponivel",
        totalEntregas: 5,
        receitaTotal: 3200,
        despesaTotal: 900,
        lucro: 2300,
        resultadoLiquido: 2300,
        margem: 71.88,
        rentabilidade: 71.88,
      },
    ],
    motoristas: [
      {
        motoristaId: "99b8d761-3792-43c4-ab67-5520d5f11003",
        nome: "Paulo Nunes",
        status: "ativo",
        totalEntregas: 5,
        receitaTotal: 3200,
        despesaTotal: 900,
        lucro: 2300,
        resultadoLiquido: 2300,
        margem: 71.88,
        rentabilidade: 71.88,
      },
    ],
    ranking: {
      topVeiculosLucratividade: [],
      topMotoristasLucratividade: [],
      maioresDespesas: [
        {
          id: "56f29d1a-b2f1-47a5-9533-c9d3ba34ea2a",
          descricao: "Troca de pneus",
          tipo: "manutencao",
          valor: 1000,
          status: "pago",
          dataDespesa: "2026-06-10",
          veiculo: {
            placa: "ABC1D23",
            modelo: "Sprinter",
          },
          motorista: {
            nome: "Paulo Nunes",
          },
        },
      ],
    },
  };
}

test.afterEach(() => {
  restoreRepositories();
});

test("relatorio por cliente exige autenticacao", async () => {
  const response = await request(app).get("/api/relatorios/clientes");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("retorna resumo por cliente autenticado", async () => {
  mockAuthenticatedUser();
  reportRepository.listByClient = async () => ({
    clientes: [createClientRow()],
    apoio: {
      clientes: [
        {
          id: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
          nome: "Acme Logistica",
          documento: "12.345.678/0001-90",
          status: "ativo",
        },
      ],
    },
  });

  const response = await request(app)
    .get("/api/relatorios/clientes?dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.clientes[0].totalEntregas, 4);
  assert.equal(response.body.resumo.receitaTotal, 1200.5);
  assert.equal(response.body.resumo.valorPendente, 350.5);
  assert.equal(response.body.resumo.valorPago, 850);
  assert.equal(response.body.ranking.topReceita[0].nome, "Acme Logistica");
});

test("encaminha filtro por periodo ao repositorio", async () => {
  mockAuthenticatedUser();
  let receivedFilters = null;
  reportRepository.listByClient = async (_userId, filters) => {
    receivedFilters = filters;
    return { clientes: [], apoio: { clientes: [] } };
  };

  const response = await request(app)
    .get("/api/relatorios/clientes?dataInicio=2026-06-01&dataFim=2026-06-15")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilters.dataInicio, "2026-06-01");
  assert.equal(receivedFilters.dataFim, "2026-06-15");
});

test("encaminha filtro por cliente ao repositorio", async () => {
  mockAuthenticatedUser();
  let receivedFilters = null;
  reportRepository.listByClient = async (_userId, filters) => {
    receivedFilters = filters;
    return { clientes: [], apoio: { clientes: [] } };
  };

  const response = await request(app)
    .get("/api/relatorios/clientes?clienteId=d57f0340-2e40-4da3-8437-f474d7ffd2ce&dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilters.clienteId, "d57f0340-2e40-4da3-8437-f474d7ffd2ce");
});

test("detalhe de cliente retorna resumo financeiro e operacional", async () => {
  mockAuthenticatedUser();
  reportRepository.getClientReportDetails = async () => ({
    cliente: {
      id: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
      nome: "Acme Logistica",
      documento: "12.345.678/0001-90",
      cidade: "Sao Paulo",
      estado: "SP",
      status: "ativo",
    },
    resumoOperacional: {
      totalEntregas: 4,
      entregasPendentes: 1,
      entregasEmRota: 1,
      entregasEntregues: 2,
      entregasCanceladas: 0,
      totalRotasVinculadas: 2,
      totalComprovantes: 3,
    },
    resumoFinanceiro: {
      receitaTotal: 1200.5,
      valorPendente: 350.5,
      valorPago: 850,
      lancamentosVencidos: 1,
    },
    entregasRecentes: [
      {
        id: "c79086e6-94ce-4376-b0c2-6de9454cb64d",
        codigo: "ENT-001",
        cliente: "Acme Logistica",
        status: "entregue",
      },
    ],
    lancamentosRecentes: [
      {
        id: "4d717d47-cbc2-46ab-9040-77f3219ab86c",
        descricao: "Repasse semanal",
        valor: 350.5,
        status: "pago",
      },
    ],
    comprovantes: [
      {
        id: "68b92e32-68d0-4ef7-9bd2-6bd79857f0f6",
        codigoEntrega: "ENT-001",
        tipo: "foto",
        ativo: true,
      },
    ],
  });

  const response = await request(app)
    .get("/api/relatorios/clientes/d57f0340-2e40-4da3-8437-f474d7ffd2ce")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.cliente.nome, "Acme Logistica");
  assert.equal(response.body.resumoFinanceiro.receitaTotal, 1200.5);
  assert.equal(response.body.resumoOperacional.totalEntregas, 4);
  assert.equal(response.body.comprovantes.length, 1);
});

test("exportacao csv exige autenticacao", async () => {
  const response = await request(app).get("/api/relatorios/clientes/export.csv");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("exportacao csv retorna cabecalho correto e attachment", async () => {
  mockAuthenticatedUser();
  reportRepository.listByClient = async () => ({
    clientes: [createClientRow()],
    apoio: { clientes: [] },
  });

  const response = await request(app)
    .get("/api/relatorios/clientes/export.csv?dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/csv/);
  assert.match(response.headers["content-disposition"], /attachment/);
  assert.match(response.text.split("\n")[0], /cliente,documento,total de entregas/);
  assert.match(response.text, /Acme Logistica/);
});

test("exportacao csv respeita filtro de cliente e periodo", async () => {
  mockAuthenticatedUser();
  let receivedFilters = null;
  reportRepository.listByClient = async (_userId, filters) => {
    receivedFilters = filters;
    return {
      clientes: [createClientRow()],
      apoio: { clientes: [] },
    };
  };

  const response = await request(app)
    .get("/api/relatorios/clientes/export.csv?clienteId=d57f0340-2e40-4da3-8437-f474d7ffd2ce&dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilters.clienteId, "d57f0340-2e40-4da3-8437-f474d7ffd2ce");
  assert.equal(receivedFilters.dataInicio, "2026-06-01");
  assert.equal(receivedFilters.dataFim, "2026-06-30");
});

test("exportacao xlsx exige autenticacao", async () => {
  const response = await request(app).get("/api/relatorios/clientes/export.xlsx");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});

test("exportacao xlsx retorna content-type e disposition corretos", async () => {
  mockAuthenticatedUser();
  reportRepository.listByClient = async () => ({
    clientes: [createClientRow()],
    apoio: { clientes: [] },
  });

  const response = await request(app)
    .get("/api/relatorios/clientes/export.xlsx?dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(
    response.headers["content-type"],
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  assert.match(response.headers["content-disposition"], /attachment/);
});

test("exportacao xlsx gera arquivo nao vazio e respeita filtros", async () => {
  mockAuthenticatedUser();
  let receivedFilters = null;
  reportRepository.listByClient = async (_userId, filters) => {
    receivedFilters = filters;
    return {
      clientes: [createClientRow()],
      apoio: { clientes: [] },
    };
  };

  const response = await request(app)
    .get("/api/relatorios/clientes/export.xlsx?clienteId=d57f0340-2e40-4da3-8437-f474d7ffd2ce&dataInicio=2026-06-01&dataFim=2026-06-30")
    .buffer(true)
    .parse(binaryParser)
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(receivedFilters.clienteId, "d57f0340-2e40-4da3-8437-f474d7ffd2ce");
  assert.equal(receivedFilters.dataInicio, "2026-06-01");
  assert.equal(receivedFilters.dataFim, "2026-06-30");
  assert.ok(response.body.length > 0);
  assert.equal(response.body[0], 0x50);
  assert.equal(response.body[1], 0x4b);
});

test("ranking ordena clientes por receita, volume e pendencias", async () => {
  mockAuthenticatedUser();
  reportRepository.listByClient = async () => ({
    clientes: [
      createClientRow({
        clienteId: "11111111-1111-4111-8111-111111111111",
        nome: "Beta",
        receitaTotal: 2000,
        totalEntregas: 3,
        valorPendente: 150,
        lancamentosVencidos: 0,
      }),
      createClientRow({
        clienteId: "22222222-2222-4222-8222-222222222222",
        nome: "Acme",
        receitaTotal: 1200.5,
        totalEntregas: 5,
        valorPendente: 950,
        lancamentosVencidos: 4,
      }),
      createClientRow({
        clienteId: "33333333-3333-4333-8333-333333333333",
        nome: "Gamma",
        receitaTotal: 800,
        totalEntregas: 8,
        valorPendente: 500,
        lancamentosVencidos: 2,
      }),
    ],
    apoio: { clientes: [] },
  });

  const response = await request(app)
    .get("/api/relatorios/clientes?dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.ranking.topReceita[0].nome, "Beta");
  assert.equal(response.body.ranking.topVolumeEntregas[0].nome, "Gamma");
  assert.equal(response.body.ranking.topValorPendente[0].nome, "Acme");
  assert.equal(response.body.ranking.clientesComLancamentosVencidos[0].nome, "Acme");
});

test("relatorio de custos da frota retorna rentabilidade operacional", async () => {
  mockAuthenticatedUser();
  reportRepository.getFleetCostReport = async () => createFleetReport();

  const response = await request(app)
    .get("/api/relatorios/frota/custos?dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.receitaTotal, 5400);
  assert.equal(response.body.resumo.resultadoLiquido, 3500);
  assert.equal(response.body.veiculos[0].placa, "ABC1D23");
  assert.equal(response.body.motoristas[0].rentabilidade, 71.88);
});

test("exportacao csv da frota retorna attachment e conteudo esperado", async () => {
  mockAuthenticatedUser();
  reportRepository.getFleetCostReport = async () => createFleetReport();

  const response = await request(app)
    .get("/api/relatorios/frota/custos/export.csv?dataInicio=2026-06-01&dataFim=2026-06-30")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/csv/);
  assert.match(response.headers["content-disposition"], /attachment/);
  assert.match(response.text.split("\n")[0], /categoria,identificador,descricao/);
  assert.match(response.text, /ABC1D23/);
});

test("exportacao xlsx da frota retorna arquivo nao vazio", async () => {
  mockAuthenticatedUser();
  reportRepository.getFleetCostReport = async () => createFleetReport();

  const response = await request(app)
    .get("/api/relatorios/frota/custos/export.xlsx?dataInicio=2026-06-01&dataFim=2026-06-30")
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
