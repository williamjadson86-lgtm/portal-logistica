const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const deliveryRepository = require("../src/repositories/deliveryRepository");
const noticeRepository = require("../src/repositories/noticeRepository");
const settingsRepository = require("../src/repositories/settingsRepository");
const profileRepository = require("../src/repositories/profileRepository");
const routePlanningRepository = require("../src/repositories/routePlanningRepository");
const proofRepository = require("../src/repositories/proofRepository");
const financeRepository = require("../src/repositories/financeRepository");
const documentRepository = require("../src/repositories/documentRepository");
const supportRepository = require("../src/repositories/supportRepository");
const clientRepository = require("../src/repositories/clientRepository");
const driverRepository = require("../src/repositories/driverRepository");
const vehicleRepository = require("../src/repositories/vehicleRepository");
const app = require("../src/app");

const originalRepositories = {
  findById: userRepository.findById,
  getDashboardSummary: deliveryRepository.getDashboardSummary,
  getRouteDashboardSummary: routePlanningRepository.getDashboardSummary,
  getRouteSupportData: routePlanningRepository.getSupportData,
  listActive: noticeRepository.listActive,
  findSettings: settingsRepository.findByUserId,
  findProfile: profileRepository.findByUserId,
  listRoutes: routePlanningRepository.listByUserId,
  listProofs: proofRepository.listByUserId,
  listProofDeliveries: proofRepository.listDeliveriesForProofs,
  listFinance: financeRepository.listByUserId,
  financeSupportData: financeRepository.listSupportData,
  listDocuments: documentRepository.listByUserId,
  listSupport: supportRepository.listByUserId,
  listClients: clientRepository.listByUserId,
  listDrivers: driverRepository.listByUserId,
  listVehicles: vehicleRepository.listByUserId,
};

const modulePages = [
  "/perfil",
  "/entregas",
  "/rotas",
  "/clientes",
  "/motoristas",
  "/veiculos",
  "/comprovantes",
  "/financeiro",
  "/documentos",
  "/suporte",
  "/avisos",
  "/configuracoes",
];

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  deliveryRepository.getDashboardSummary = originalRepositories.getDashboardSummary;
  routePlanningRepository.getDashboardSummary =
    originalRepositories.getRouteDashboardSummary;
  routePlanningRepository.getSupportData = originalRepositories.getRouteSupportData;
  noticeRepository.listActive = originalRepositories.listActive;
  settingsRepository.findByUserId = originalRepositories.findSettings;
  profileRepository.findByUserId = originalRepositories.findProfile;
  routePlanningRepository.listByUserId = originalRepositories.listRoutes;
  proofRepository.listByUserId = originalRepositories.listProofs;
  proofRepository.listDeliveriesForProofs = originalRepositories.listProofDeliveries;
  financeRepository.listByUserId = originalRepositories.listFinance;
  financeRepository.listSupportData = originalRepositories.financeSupportData;
  documentRepository.listByUserId = originalRepositories.listDocuments;
  supportRepository.listByUserId = originalRepositories.listSupport;
  clientRepository.listByUserId = originalRepositories.listClients;
  driverRepository.listByUserId = originalRepositories.listDrivers;
  vehicleRepository.listByUserId = originalRepositories.listVehicles;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "1b36b068-cc2c-4388-a5de-2528ba53a1c9",
      nome: "Jadson William",
      matricula: "COL1234",
      tipoUsuario: "colaborador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

test.afterEach(() => {
  restoreRepositories();
});

test("home api retorna dashboard de entregas autenticado", async () => {
  userRepository.findById = async () => ({
    id: "1b36b068-cc2c-4388-a5de-2528ba53a1c9",
    nome: "Jadson William",
    matricula: "COL1234",
    tipoUsuario: "colaborador",
    ativo: true,
  });
  deliveryRepository.getDashboardSummary = async () => ({
    total: 7,
    emTransito: 2,
    entregues: 4,
    pendentes: 1,
  });
  routePlanningRepository.getDashboardSummary = async () => ({
    total: 5,
    planejadas: 2,
    emAndamento: 2,
    concluidas: 1,
  });

  const response = await request(app)
    .get("/api/portal/home")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.dashboard.totalEntregas, 7);
  assert.equal(response.body.dashboard.entregasEntregues, 4);
  assert.equal(response.body.rotas.rotasPlanejadas, 2);
  assert.equal(response.body.cards.length, 12);
});

test("modulos html exigem autenticacao", async () => {
  for (const page of modulePages) {
    const response = await request(app).get(page);

    assert.equal(response.status, 302);
    assert.equal(response.headers.location, "/login");
  }
});

test("apis dos modulos auxiliares respondem autenticadas", async () => {
  userRepository.findById = async () => ({
    id: "1b36b068-cc2c-4388-a5de-2528ba53a1c9",
    nome: "Jadson William",
    matricula: "COL1234",
    tipoUsuario: "colaborador",
    ativo: true,
  });
  profileRepository.findByUserId = async () => ({
    profile: {
      nome: "Jadson William",
      cpf: "123.456.789-09",
      email: "jadson@example.com",
      telefone: "(11) 90000-0000",
      matricula: "COL1234",
      tipoUsuario: "colaborador",
      ativo: true,
      criadoEm: new Date().toISOString(),
    },
    counters: {
      entregas: 3,
      documentos: 2,
      chamados_abertos: 1,
      lancamentos: 4,
    },
  });
  routePlanningRepository.listByUserId = async () => [
    {
      id: "1f8ad72f-b4a2-4125-9ee7-d0412b55a792",
      codigo: "ROT-001",
      motoristaId: "9f96ec45-2773-4afb-b596-053f9a9926d3",
      motoristaNome: "Marcio Lima",
      veiculoId: "9d1f2f93-422a-4dd6-b443-5286b6a3fb38",
      veiculoPlaca: "ABC1D23",
      origem: "Centro",
      destino: "Zona Sul",
      dataRota: "2026-06-09",
      status: "planejada",
      observacoes: "",
      totalEntregasAtivas: 1,
      totalEntregasHistorico: 1,
    },
  ];
  routePlanningRepository.getSupportData = async () => ({
    motoristas: [{ id: "9f96ec45-2773-4afb-b596-053f9a9926d3", nome: "Marcio Lima" }],
    veiculos: [
      {
        id: "9d1f2f93-422a-4dd6-b443-5286b6a3fb38",
        placa: "ABC1D23",
        modelo: "Sprinter",
      },
    ],
    entregasDisponiveis: [],
  });
  proofRepository.listByUserId = async () => [
    {
      id: "68b92e32-68d0-4ef7-9bd2-6bd79857f0f6",
      entregaId: "c79086e6-94ce-4376-b0c2-6de9454cb64d",
      codigoEntrega: "ENT-001",
      cliente: "Acme",
      tipo: "foto",
      arquivoNome: "canhoto.jpg",
      arquivoCaminho: "uploads/comprovantes/canhoto.jpg",
      mimeType: "image/jpeg",
      tamanhoBytes: 1200,
      observacao: "Entrega validada",
      ativo: true,
      criadoEm: new Date().toISOString(),
    },
  ];
  proofRepository.listDeliveriesForProofs = async () => [
    {
      id: "c79086e6-94ce-4376-b0c2-6de9454cb64d",
      codigo: "ENT-001",
      cliente: "Acme",
      status: "entregue",
    },
  ];
  financeRepository.listByUserId = async () => [
    {
      id: "4d717d47-cbc2-46ab-9040-77f3219ab86c",
      usuarioId: "1b36b068-cc2c-4388-a5de-2528ba53a1c9",
      clienteId: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
      entregaId: "c79086e6-94ce-4376-b0c2-6de9454cb64d",
      descricao: "Repasse semanal",
      tipo: "receita",
      valor: 350.9,
      status: "pago",
      dataCompetencia: "2026-06-09",
      dataVencimento: "2026-06-12",
      dataPagamento: "2026-06-10",
      observacoes: "",
      cliente: {
        id: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
        nome: "Acme Logistica",
        documento: "12345678000190",
        status: "ativo",
      },
      entrega: {
        id: "c79086e6-94ce-4376-b0c2-6de9454cb64d",
        codigo: "ENT-001",
        cliente: "Acme",
        status: "entregue",
        valorFrete: 350.9,
      },
    },
  ];
  financeRepository.listSupportData = async () => ({
    clientes: [
      {
        id: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
        nome: "Acme Logistica",
        documento: "12345678000190",
        status: "ativo",
      },
    ],
    entregas: [
      {
        id: "c79086e6-94ce-4376-b0c2-6de9454cb64d",
        codigo: "ENT-001",
        cliente: "Acme",
        status: "entregue",
        dataPrevista: "2026-06-09",
        valorFrete: 350.9,
        temLancamentoAtivo: true,
      },
    ],
  });
  documentRepository.listByUserId = async () => [
    {
      nome: "CNH",
      tipo: "Motorista",
      status: "aprovado",
      validadeEm: "2027-06-09",
    },
  ];
  supportRepository.listByUserId = async () => [
    {
      assunto: "Acesso ao app",
      categoria: "Sistema",
      prioridade: "media",
      status: "aberto",
      mensagem: "Sem sincronizacao",
      atualizadoEm: new Date().toISOString(),
    },
  ];
  clientRepository.listByUserId = async () => [
    {
      id: "d57f0340-2e40-4da3-8437-f474d7ffd2ce",
      nome: "Acme Logistica",
      documento: "12.345.678/0001-90",
      email: "contato@acme.com",
      telefone: "(11) 90000-0000",
      contatoNome: "Marcia",
      cidade: "Sao Paulo",
      estado: "SP",
      endereco: "Av. Paulista, 100",
      status: "ativo",
      observacoes: "",
    },
  ];
  noticeRepository.listActive = async () => [
    {
      titulo: "Comunicado",
      conteudo: "Teste",
      prioridade: "importante",
      publicadoEm: new Date().toISOString(),
    },
  ];
  settingsRepository.findByUserId = async () => ({
    tema: "claro",
    idioma: "pt-BR",
    notificacoesEmail: true,
    notificacoesPush: true,
    atualizadoEm: new Date().toISOString(),
  });
  driverRepository.listByUserId = async () => [
    {
      id: "7455781a-497c-4803-bb63-5ae51fb920ea",
      nome: "Marcio Lima",
      cpf: "123.456.789-09",
      cnh: "SP1234567",
      categoriaCnh: "D",
      validadeCnh: "2027-06-09",
      telefone: "(11) 99999-0000",
      status: "ativo",
    },
  ];
  vehicleRepository.listByUserId = async () => [
    {
      id: "0c474673-1f63-4f65-b41d-feb89fca5100",
      placa: "ABC1D23",
      modelo: "Sprinter",
      tipo: "Van",
      capacidade: 1500,
      ano: 2024,
      status: "disponivel",
    },
  ];

  const apiResponses = await Promise.all([
    request(app).get("/api/perfil").set("Cookie", createCookie()),
    request(app).get("/api/rotas").set("Cookie", createCookie()),
    request(app).get("/api/comprovantes").set("Cookie", createCookie()),
    request(app).get("/api/financeiro").set("Cookie", createCookie()),
    request(app).get("/api/documentos").set("Cookie", createCookie()),
    request(app).get("/api/suporte").set("Cookie", createCookie()),
    request(app).get("/api/clientes").set("Cookie", createCookie()),
    request(app).get("/api/avisos").set("Cookie", createCookie()),
    request(app).get("/api/configuracoes").set("Cookie", createCookie()),
    request(app).get("/api/motoristas").set("Cookie", createCookie()),
    request(app).get("/api/veiculos").set("Cookie", createCookie()),
  ]);

  assert.equal(apiResponses[0].body.resumo[0].valor, "colaborador");
  assert.equal(apiResponses[1].body.rotas[0].codigo, "ROT-001");
  assert.equal(apiResponses[2].body.comprovantes[0].arquivoNome, "canhoto.jpg");
  assert.equal(apiResponses[3].body.lancamentos[0].descricao, "Repasse semanal");
  assert.equal(apiResponses[6].body.clientes[0].nome, "Acme Logistica");
  assert.equal(apiResponses[7].body.itens.length, 1);
  assert.equal(apiResponses[8].body.resumo[0].valor, "claro");
  assert.equal(apiResponses[9].body.motoristas[0].nome, "Marcio Lima");
  assert.equal(apiResponses[10].body.veiculos[0].placa, "ABC1D23");
});
