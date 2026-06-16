const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const env = require("../src/config/env");
const app = require("../src/app");
const userRepository = require("../src/repositories/userRepository");
const settingsRepository = require("../src/repositories/settingsRepository");
const companyRepository = require("../src/repositories/companyRepository");

const originalRepositories = {
  findById: userRepository.findById,
  listByActor: userRepository.listByActor,
  findByIdForActor: userRepository.findByIdForActor,
  createManagedUser: userRepository.createManagedUser,
  updateByIdForActor: userRepository.updateByIdForActor,
  updateStatusByIdForActor: userRepository.updateStatusByIdForActor,
  updateRoleByIdForActor: userRepository.updateRoleByIdForActor,
  resetPasswordByIdForActor: userRepository.resetPasswordByIdForActor,
  findSettings: settingsRepository.findByUserId,
  updateSettings: settingsRepository.updateByUserId,
  listPermissions: settingsRepository.listPermissions,
  listCompanies: companyRepository.listByActor,
  findCompany: companyRepository.findByIdForActor,
  updateCompany: companyRepository.updateByIdForActor,
};

function restoreRepositories() {
  userRepository.findById = originalRepositories.findById;
  userRepository.listByActor = originalRepositories.listByActor;
  userRepository.findByIdForActor = originalRepositories.findByIdForActor;
  userRepository.createManagedUser = originalRepositories.createManagedUser;
  userRepository.updateByIdForActor = originalRepositories.updateByIdForActor;
  userRepository.updateStatusByIdForActor = originalRepositories.updateStatusByIdForActor;
  userRepository.updateRoleByIdForActor = originalRepositories.updateRoleByIdForActor;
  userRepository.resetPasswordByIdForActor = originalRepositories.resetPasswordByIdForActor;
  settingsRepository.findByUserId = originalRepositories.findSettings;
  settingsRepository.updateByUserId = originalRepositories.updateSettings;
  settingsRepository.listPermissions = originalRepositories.listPermissions;
  companyRepository.listByActor = originalRepositories.listCompanies;
  companyRepository.findByIdForActor = originalRepositories.findCompany;
  companyRepository.updateByIdForActor = originalRepositories.updateCompany;
}

function createCookie(tipoUsuario = "gestor") {
  const token = jwt.sign(
    {
      sub: "7cb5dff0-e29d-454b-97d0-11b9c8357ec7",
      empresaId: "empresa-900",
      nome: "Admin Empresa",
      matricula: "ADM9000",
      tipoUsuario,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return `${env.cookieName}=${token}`;
}

function mockAuthenticatedUser(tipoUsuario = "gestor") {
  userRepository.findById = async () => ({
    id: "7cb5dff0-e29d-454b-97d0-11b9c8357ec7",
    empresaId: "empresa-900",
    nome: "Admin Empresa",
    cpf: "529.982.247-25",
    email: "admin@empresa.com",
    telefone: "(11) 99999-9999",
    matricula: "ADM9000",
    tipoUsuario,
    ativo: true,
  });
}

test.afterEach(() => {
  restoreRepositories();
});

test("configuracoes retorna empresa, usuarios e permissoes para gestor", async () => {
  mockAuthenticatedUser("gestor");
  settingsRepository.findByUserId = async () => ({
    empresa: {
      id: "empresa-900",
      razaoSocial: "Empresa XPTO LTDA",
      nomeFantasia: "XPTO",
      cnpj: "04.252.011/0001-10",
      status: "ativo",
    },
    configuracoes: {
      timezone: "America/Sao_Paulo",
      moeda: "BRL",
      formatoData: "DD/MM/YYYY",
      dashboardPeriodoPadrao: "7d",
      dashboardExibirFinanceiro: true,
    },
    resumoUsuarios: {
      total: 3,
      ativos: 2,
      bloqueados: 1,
    },
  });
  userRepository.listByActor = async () => [
    {
      id: "usuario-1",
      nome: "Ana",
      email: "ana@empresa.com",
      documento: "529.982.247-25",
      matricula: "COL1234",
      perfil: "operador",
      status: "ativo",
      ativo: true,
    },
  ];
  settingsRepository.listPermissions = async () => ({
    perfis: [{ perfil: "gestor", modulosLiberados: ["/configuracoes"], permissoesEfetivas: ["settings:view"], restricoes: [] }],
    permissoes: ["settings:view", "users:manage"],
  });

  const response = await request(app)
    .get("/api/configuracoes")
    .set("Cookie", createCookie("gestor"));

  assert.equal(response.status, 200);
  assert.equal(response.body.empresa.razaoSocial, "Empresa XPTO LTDA");
  assert.equal(response.body.usuarios[0].matricula, "COL1234");
  assert.equal(response.body.permissoes.perfis[0].perfil, "gestor");
});

test("pagina de configuracoes responde autenticada", async () => {
  mockAuthenticatedUser("gestor");

  const response = await request(app)
    .get("/configuracoes")
    .set("Cookie", createCookie("gestor"));

  assert.equal(response.status, 200);
  assert.match(response.text, /Configuracoes da empresa/);
  assert.match(response.text, /Gestao de usuarios da empresa/);
});

test("lista usuarios da empresa autenticada", async () => {
  mockAuthenticatedUser("gestor");
  userRepository.listByActor = async () => [
    {
      id: "usuario-2",
      nome: "Bruno",
      email: "bruno@empresa.com",
      documento: "123.456.789-00",
      matricula: "USR1000",
      perfil: "financeiro",
      status: "ativo",
      ativo: true,
    },
  ];

  const response = await request(app)
    .get("/api/usuarios")
    .set("Cookie", createCookie("gestor"));

  assert.equal(response.status, 200);
  assert.equal(response.body.resumo.total, 1);
  assert.equal(response.body.usuarios[0].perfil, "financeiro");
});

test("cria usuario usando empresa_id do usuario autenticado", async () => {
  mockAuthenticatedUser("gestor");
  let receivedUser;
  userRepository.createManagedUser = async (_actor, payload) => {
    receivedUser = payload;
    return {
      id: "novo-usuario",
      nome: payload.nome,
      email: payload.email,
      documento: payload.documento,
      matricula: payload.matricula,
      perfil: payload.tipoUsuario,
      status: payload.status,
      ativo: true,
    };
  };

  const response = await request(app)
    .post("/api/usuarios")
    .set("Cookie", createCookie("gestor"))
    .send({
      nome: "Novo Usuario",
      email: "novo@empresa.com",
      documento: "529.982.247-25",
      telefone: "(11) 98888-7777",
      matricula: "NOV1000",
      perfil: "operador",
      status: "ativo",
      senha: "Senha@123",
      empresa_id: "empresa-invasora",
    });

  assert.equal(response.status, 201);
  assert.equal(receivedUser.tipoUsuario, "operador");
  assert.equal(response.body.usuario.id, "novo-usuario");
});

test("atualiza empresa da sessao sem cruzar tenant", async () => {
  mockAuthenticatedUser("gestor");
  companyRepository.updateByIdForActor = async (_actor, companyId, payload) => ({
    id: companyId,
    ...payload,
  });

  const response = await request(app)
    .patch("/api/empresas/4f3902f6-f4fc-4bd1-9f9f-a5093e908558")
    .set("Cookie", createCookie("gestor"))
    .send({
      razaoSocial: "Empresa Atualizada LTDA",
      nomeFantasia: "Atualizada",
      cnpj: "04.252.011/0001-10",
      email: "contato@atualizada.com",
      telefone: "(11) 97777-6666",
      endereco: "Rua A, 10",
      cidade: "Sao Paulo",
      estado: "SP",
      cep: "01001000",
      status: "ativo",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.empresa.razaoSocial, "Empresa Atualizada LTDA");
});

test("lista permissoes administrativas", async () => {
  mockAuthenticatedUser("gestor");
  settingsRepository.listPermissions = () => ({
    perfis: [{ perfil: "gestor" }],
    permissoes: ["settings:view", "users:manage"],
  });

  const response = await request(app)
    .get("/api/permissoes")
    .set("Cookie", createCookie("gestor"));

  assert.equal(response.status, 200);
  assert.equal(response.body.permissoes[0], "settings:view");
});

test("usuario sem permissao recebe 403 em gestao de usuarios", async () => {
  mockAuthenticatedUser("operador");

  const response = await request(app)
    .get("/api/usuarios")
    .set("Cookie", createCookie("operador"));

  assert.equal(response.status, 403);
  assert.equal(response.body.erro, "Acesso negado para o perfil atual");
});
