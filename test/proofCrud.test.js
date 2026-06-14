const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const userRepository = require("../src/repositories/userRepository");
const proofRepository = require("../src/repositories/proofRepository");
const deliveryEventRepository = require("../src/repositories/deliveryEventRepository");
const app = require("../src/app");

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "comprovantes",
);

const originalRepositories = {
  findById: userRepository.findById,
  listForUser: proofRepository.listForUser,
  listDeliveriesForUser: proofRepository.listDeliveriesForUser,
  findProofByIdForUser: proofRepository.findByIdForUser,
  createForUser: proofRepository.createForUser,
  updateById: proofRepository.updateById,
  deactivateById: proofRepository.deactivateById,
  appendEvent: deliveryEventRepository.appendEvent,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  proofRepository.listForUser = originalRepositories.listForUser;
  proofRepository.listDeliveriesForUser = originalRepositories.listDeliveriesForUser;
  proofRepository.findByIdForUser = originalRepositories.findProofByIdForUser;
  proofRepository.createForUser = originalRepositories.createForUser;
  proofRepository.updateById = originalRepositories.updateById;
  proofRepository.deactivateById = originalRepositories.deactivateById;
  deliveryEventRepository.appendEvent = originalRepositories.appendEvent;
}

function cleanupUploads() {
  if (!fs.existsSync(uploadDir)) {
    return;
  }

  for (const file of fs.readdirSync(uploadDir)) {
    fs.rmSync(path.join(uploadDir, file), { force: true });
  }
}

function createCookie() {
  const token = jwt.sign(
    {
      sub: "190fa67e-855d-42b0-96cc-805634396ebf",
      nome: "Comprovante Tester",
      matricula: "PRF2026",
      tipoUsuario: "operador",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser() {
  userRepository.findById = async () => ({
    id: "190fa67e-855d-42b0-96cc-805634396ebf",
    nome: "Comprovante Tester",
    matricula: "PRF2026",
    tipoUsuario: "operador",
    ativo: true,
  });
  deliveryEventRepository.appendEvent = async (event) => ({ id: "evt-default", ...event });
}

function proofFixture(overrides = {}) {
  return {
    id: "c0cd7356-436a-4e18-9ea5-583f1e019326",
    entregaId: "93867b68-d624-4a4d-a7e8-a1e1a0b3c3d3",
    usuarioId: "190fa67e-855d-42b0-96cc-805634396ebf",
    codigoEntrega: "ENT-900",
    cliente: "Acme",
    tipo: "foto",
    arquivoNome: "canhoto.jpg",
    arquivoCaminho: "uploads/comprovantes/canhoto.jpg",
    mimeType: "image/jpeg",
    tamanhoBytes: 1024,
    observacao: "Recebido no destino",
    ativo: true,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...overrides,
  };
}

test.afterEach(() => {
  restoreRepositories();
  cleanupUploads();
});

test("upload de comprovante autenticado", async () => {
  mockAuthenticatedUser();
  let capturedEvent = null;
  proofRepository.createForUser = async (_user, _entregaId, payload) =>
    proofFixture({
      tipo: payload.tipo,
      arquivoNome: payload.arquivoNome,
      mimeType: payload.mimeType,
      tamanhoBytes: payload.tamanhoBytes,
      observacao: payload.observacao,
    });
  deliveryEventRepository.appendEvent = async (event) => {
    capturedEvent = event;
    return { id: "evt-proof-1", ...event };
  };

  const response = await request(app)
    .post("/api/entregas/93867b68-d624-4a4d-a7e8-a1e1a0b3c3d3/comprovantes")
    .set("Cookie", createCookie())
    .field("tipo", "foto")
    .field("observacao", "Recebido no destino")
    .attach("arquivo", Buffer.from("jpeg-file"), {
      filename: "canhoto.jpg",
      contentType: "image/jpeg",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.comprovante.arquivoNome, "canhoto.jpg");
  assert.equal(capturedEvent.tipoEvento, "comprovante_enviado");
});

test("bloqueia tipo de arquivo invalido", async () => {
  mockAuthenticatedUser();

  const response = await request(app)
    .post("/api/entregas/93867b68-d624-4a4d-a7e8-a1e1a0b3c3d3/comprovantes")
    .set("Cookie", createCookie())
    .field("tipo", "pdf")
    .attach("arquivo", Buffer.from("plain-text"), {
      filename: "arquivo.txt",
      contentType: "text/plain",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.erro, "Tipo de arquivo nao permitido");
});

test("bloqueia arquivo grande", async () => {
  mockAuthenticatedUser();

  const response = await request(app)
    .post("/api/entregas/93867b68-d624-4a4d-a7e8-a1e1a0b3c3d3/comprovantes")
    .set("Cookie", createCookie())
    .field("tipo", "pdf")
    .attach("arquivo", Buffer.alloc(6 * 1024 * 1024, 1), {
      filename: "arquivo.pdf",
      contentType: "application/pdf",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.erro, "Arquivo excede o tamanho maximo permitido");
});

test("lista comprovantes por entrega", async () => {
  mockAuthenticatedUser();
  proofRepository.listForUser = async (_user, filters) => [
    proofFixture({ entregaId: filters.entregaId }),
  ];

  const response = await request(app)
    .get("/api/entregas/93867b68-d624-4a4d-a7e8-a1e1a0b3c3d3/comprovantes")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.comprovantes[0].codigoEntrega, "ENT-900");
});

test("inativa comprovante", async () => {
  mockAuthenticatedUser();
  proofRepository.findByIdForUser = async () => proofFixture();
  proofRepository.deactivateById = async () => ({ id: "c0cd7356-436a-4e18-9ea5-583f1e019326" });

  const response = await request(app)
    .delete("/api/comprovantes/c0cd7356-436a-4e18-9ea5-583f1e019326")
    .set("Cookie", createCookie());

  assert.equal(response.status, 200);
  assert.equal(response.body.mensagem, "Comprovante inativado com sucesso");
});

test("api de comprovantes exige autenticacao", async () => {
  const response = await request(app).get("/api/comprovantes");

  assert.equal(response.status, 401);
  assert.equal(response.body.erro, "Autenticacao obrigatoria");
});
