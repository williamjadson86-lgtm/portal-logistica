const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const fs = require("fs");
const path = require("path");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const deliveryRepository = require("../src/repositories/deliveryRepository");
const deliveryEventRepository = require("../src/repositories/deliveryEventRepository");
const proofRepository = require("../src/repositories/proofRepository");
const financeRepository = require("../src/repositories/financeRepository");
const app = require("../src/app");
const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "comprovantes",
);

const originalRepositories = {
  findById: userRepository.findById,
  listByUserId: deliveryRepository.listByUserId,
  findByDeliveryId: deliveryRepository.findById,
  create: deliveryRepository.create,
  updateById: deliveryRepository.updateById,
  updateStatusById: deliveryRepository.updateStatusById,
  deleteById: deliveryRepository.deleteById,
  createProof: proofRepository.create,
  cancelPendingByDeliveryId: financeRepository.cancelPendingByDeliveryId,
  createFinancialEntry: financeRepository.createFromDelivery,
  appendEvent: deliveryEventRepository.appendEvent,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  deliveryRepository.listByUserId = originalRepositories.listByUserId;
  deliveryRepository.findById = originalRepositories.findByDeliveryId;
  deliveryRepository.create = originalRepositories.create;
  deliveryRepository.updateById = originalRepositories.updateById;
  deliveryRepository.updateStatusById = originalRepositories.updateStatusById;
  deliveryRepository.deleteById = originalRepositories.deleteById;
  proofRepository.create = originalRepositories.createProof;
  financeRepository.cancelPendingByDeliveryId = originalRepositories.cancelPendingByDeliveryId;
  financeRepository.createFromDelivery = originalRepositories.createFinancialEntry;
  deliveryEventRepository.appendEvent = originalRepositories.appendEvent;
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "4df4eeb4-a4df-4ab7-b5f7-5a1f397f0d22",
      nome: "Operador Teste",
      matricula: "OPE2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "4df4eeb4-a4df-4ab7-b5f7-5a1f397f0d22",
    nome: "Operador Teste",
    matricula: "OPE2026",
    tipoUsuario: "operador",
    ativo: true,
  });
  deliveryEventRepository.appendEvent = async (event) => ({ id: "evt-default", ...event });
  financeRepository.cancelPendingByDeliveryId = async () => [];
  financeRepository.createFromDelivery = async (_userId, deliveryId, payload) => ({
    id: "fin-default",
    entregaId: deliveryId,
    tipo: payload.tipo || "receita",
    descricao: payload.descricao || "Frete da entrega",
    valor: payload.valor || 100,
    status: "pendente",
    dataCompetencia: payload.dataCompetencia || "2026-06-10",
    dataVencimento: payload.dataVencimento || null,
    dataPagamento: null,
    observacoes: payload.observacoes || "",
    cliente: null,
    entrega: {
      id: deliveryId,
      codigo: "ENT-999",
      cliente: "Cliente XPTO",
      status: "entregue",
      valorFrete: payload.valor || 100,
    },
  });
}

test.afterEach(() => {
  restoreRepositories();
  if (fs.existsSync(uploadDir)) {
    for (const file of fs.readdirSync(uploadDir)) {
      fs.rmSync(path.join(uploadDir, file), { force: true });
    }
  }
});

test("lista entregas com resumo autenticado", async () => {
  mockAuthenticatedUser();
  deliveryRepository.listByUserId = async () => [
    {
      id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
      codigo: "ENT-100",
      cliente: "Acme",
      origem: "Centro",
      destino: "Zona Sul",
      cidade: "Sao Paulo",
      estado: "SP",
      status: "pendente",
      dataPrevista: "2026-06-10",
      observacoes: "",
    },
    {
      id: "1d50fffd-02ff-4ec2-b02e-15af7ea4d103",
      codigo: "ENT-101",
      cliente: "Beta",
      origem: "Campinas",
      destino: "Osasco",
      cidade: "Osasco",
      estado: "SP",
      status: "entregue",
      dataPrevista: "2026-06-11",
      observacoes: "Confirmada",
    },
  ];

  const response = await request(app)
    .get("/api/entregas")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.totalEntregas, 2);
  assert.equal(response.body.resumo.entregues, 1);
  assert.equal(response.body.entregas[0].codigo, "ENT-100");
});

test("cria entrega com payload valido", async () => {
  mockAuthenticatedUser();
  let capturedEvent = null;
  deliveryRepository.create = async (_userId, payload) => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
    ...payload,
    observacoes: payload.observacoes || "",
  });
  deliveryEventRepository.appendEvent = async (event) => {
    capturedEvent = event;
    return { id: "evt-1", ...event };
  };

  const response = await request(app)
    .post("/api/entregas")
    .set("Cookie", createCookie())
    .send({
      codigo: "ent-500",
      cliente: "Cliente XPTO",
      origem: "Rua A, 10",
      destino: "Rua B, 20",
      cidade: "Sao Paulo",
      estado: "sp",
      status: "pendente",
      dataPrevista: "2026-06-15",
      observacoes: "Primeira coleta",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.entrega.codigo, "ENT-500");
  assert.equal(response.body.entrega.estado, "SP");
  assert.equal(capturedEvent.tipoEvento, "entrega_criada");
});

test("rejeita criacao com dados invalidos", async () => {
  mockAuthenticatedUser();

  const response = await request(app)
    .post("/api/entregas")
    .set("Cookie", createCookie())
    .send({
      codigo: "1",
      cliente: "",
      origem: "Rua A",
      destino: "",
      cidade: "",
      estado: "Sao Paulo",
      status: "desconhecido",
      dataPrevista: "15/06/2026",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.erro, "Dados invalidos");
  assert.ok(response.body.detalhes.length > 0);
});

test("busca entrega por id valido", async () => {
  mockAuthenticatedUser();
  deliveryRepository.findById = async () => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
    codigo: "ENT-501",
    cliente: "Cliente XPTO",
    origem: "Rua A, 10",
    destino: "Rua B, 20",
    cidade: "Sao Paulo",
    estado: "SP",
    status: "em_transito",
    dataPrevista: "2026-06-15",
    observacoes: "Saiu para transferencia",
  });

  const response = await request(app)
    .get("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.entrega.status, "em_transito");
});

test("detalhe da entrega retorna rota, motorista e veiculo quando houver", async () => {
  mockAuthenticatedUser();
  deliveryRepository.findById = async () => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
    codigo: "ENT-502",
    cliente: "Cliente XPTO",
    origem: "Rua A, 10",
    destino: "Rua B, 20",
    cidade: "Sao Paulo",
    estado: "SP",
    status: "em_rota",
    dataPrevista: "2026-06-15",
    observacoes: "Saiu para entrega final",
    rotaAtual: {
      id: "0f8d3d69-7e85-4eec-b1c1-0b5dfdb4bc8b",
      codigo: "ROT-301",
      status: "em_andamento",
      dataRota: "2026-06-15",
    },
    motorista: {
      id: "11d43bfa-b9d2-4282-aef0-cf76513c26db",
      nome: "Marcio Lima",
    },
    veiculo: {
      id: "6a50ab36-c165-4874-9f9a-3cbc4d2a5f23",
      placa: "ABC1D23",
      modelo: "Sprinter",
    },
  });

  const response = await request(app)
    .get("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.entrega.rotaAtual.codigo, "ROT-301");
  assert.equal(response.body.entrega.motorista.nome, "Marcio Lima");
  assert.equal(response.body.entrega.veiculo.placa, "ABC1D23");
});

test("valida uuid ao consultar entrega", async () => {
  mockAuthenticatedUser();

  const response = await request(app)
    .get("/api/entregas/invalido")
    .set("Cookie", createCookie());

  assert.equal(response.status, 400);
  assert.equal(response.body.erro, "Identificador de entrega invalido");
});

test("atualiza entrega existente", async () => {
  mockAuthenticatedUser();
  deliveryRepository.updateById = async (_userId, _deliveryId, payload) => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
    codigo: payload.codigo || "ENT-600",
    cliente: payload.cliente || "Cliente XPTO",
    origem: payload.origem || "Rua A, 10",
    destino: payload.destino || "Rua B, 20",
    cidade: payload.cidade || "Sao Paulo",
    estado: payload.estado || "SP",
    status: payload.status || "em_rota",
    dataPrevista: payload.dataPrevista || "2026-06-20",
    observacoes: payload.observacoes || "Atualizada",
  });

  const response = await request(app)
    .patch("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7")
    .set("Cookie", createCookie())
    .send({
      cliente: "Cliente Atualizado",
      status: "em_rota",
      observacoes: "Motorista em deslocamento",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.entrega.cliente, "Cliente Atualizado");
  assert.equal(response.body.entrega.status, "em_rota");
});

test("altera apenas o status da entrega", async () => {
  mockAuthenticatedUser();
  let capturedEvent = null;
  deliveryRepository.updateStatusById = async (_userId, _deliveryId, status) => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
    codigo: "ENT-700",
    cliente: "Cliente XPTO",
    origem: "Rua A, 10",
    destino: "Rua B, 20",
    cidade: "Sao Paulo",
    estado: "SP",
    status,
    dataPrevista: "2026-06-20",
    observacoes: "Status alterado",
  });
  deliveryEventRepository.appendEvent = async (event) => {
    capturedEvent = event;
    return { id: "evt-2", ...event };
  };

  const response = await request(app)
    .patch("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7/status")
    .set("Cookie", createCookie())
    .send({ status: "entregue" });

  assert.equal(response.status, 200);
  assert.equal(response.body.entrega.status, "entregue");
  assert.equal(capturedEvent.tipoEvento, "status_alterado");
});

test("ao cancelar entrega cancela lancamento financeiro pendente", async () => {
  mockAuthenticatedUser();
  let canceledDeliveryId = null;
  deliveryRepository.updateStatusById = async (_userId, deliveryId, status) => ({
    id: deliveryId,
    codigo: "ENT-701",
    cliente: "Cliente XPTO",
    origem: "Rua A, 10",
    destino: "Rua B, 20",
    cidade: "Sao Paulo",
    estado: "SP",
    status,
    dataPrevista: "2026-06-20",
    observacoes: "Cancelada",
  });
  financeRepository.cancelPendingByDeliveryId = async (_userId, deliveryId) => {
    canceledDeliveryId = deliveryId;
    return [{ id: "fin-001" }];
  };

  const response = await request(app)
    .patch("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7/status")
    .set("Cookie", createCookie())
    .send({ status: "cancelada" });

  assert.equal(response.status, 200);
  assert.equal(canceledDeliveryId, "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7");
});

test("exclui entrega existente", async () => {
  mockAuthenticatedUser();
  deliveryRepository.deleteById = async () => ({
    id: "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7",
  });

  const response = await request(app)
    .delete("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.mensagem, "Entrega excluida com sucesso");
});

test("upload rapido de comprovante pela entrega reutiliza a api existente", async () => {
  mockAuthenticatedUser();
  proofRepository.create = async (_userId, entregaId, payload) => ({
    id: "d50b8d55-8db9-4f64-8f5a-f09f2d8ab5ea",
    entregaId,
    usuarioId: "4df4eeb4-a4df-4ab7-b5f7-5a1f397f0d22",
    enviadoPor: "Operador Teste",
    codigoEntrega: "ENT-701",
    cliente: "Cliente XPTO",
    tipo: payload.tipo,
    arquivoNome: payload.arquivoNome,
    arquivoCaminho: payload.arquivoCaminho,
    mimeType: payload.mimeType,
    tamanhoBytes: payload.tamanhoBytes,
    observacao: payload.observacao,
    ativo: true,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });

  const response = await request(app)
    .post("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7/comprovantes")
    .set("Cookie", createCookie())
    .field("tipo", "foto")
    .field("observacao", "Canhoto validado na tela da entrega")
    .attach("arquivo", Buffer.from("jpeg-file"), {
      filename: "canhoto.jpg",
      contentType: "image/jpeg",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.comprovante.arquivoNome, "canhoto.jpg");
});

test("gera lancamento financeiro a partir da entrega concluida", async () => {
  mockAuthenticatedUser();
  financeRepository.createFromDelivery = async (_userId, deliveryId, payload) => ({
    id: "fin-900",
    entregaId: deliveryId,
    tipo: payload.tipo,
    descricao: payload.descricao,
    valor: payload.valor,
    status: "pendente",
    dataCompetencia: payload.dataCompetencia,
    dataVencimento: payload.dataVencimento,
    dataPagamento: null,
    observacoes: payload.observacoes,
    cliente: {
      id: "cli-900",
      nome: "Cliente XPTO",
      documento: "12345678000190",
      status: "ativo",
    },
    entrega: {
      id: deliveryId,
      codigo: "ENT-900",
      cliente: "Cliente XPTO",
      status: "entregue",
      valorFrete: 450.75,
    },
  });

  const response = await request(app)
    .post("/api/entregas/ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7/lancamento-financeiro")
    .set("Cookie", createCookie())
    .send({
      tipo: "receita",
      descricao: "Frete faturado da entrega ENT-900",
      valor: 450.75,
      dataCompetencia: "2026-06-20",
      dataVencimento: "2026-06-25",
      observacoes: "Gerado pela tela de entregas",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.lancamento.entregaId, "ab60f6d4-4a09-4b33-9afd-8f57cb44e3f7");
  assert.equal(response.body.lancamento.status, "pendente");
});
