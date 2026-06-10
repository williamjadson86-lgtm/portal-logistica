const repository = require("../repositories/clientRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateClientCreate,
  validateClientUpdate,
  validateClientStatus,
} = require("../validations/clientValidation");

function page(_req, res) {
  res.sendFile(resolveView("clientes.html"));
}

function buildSummary(clients) {
  return {
    totalClientes: clients.length,
    ativos: clients.filter((client) => client.status === "ativo").length,
    inativos: clients.filter((client) => client.status === "inativo").length,
    bloqueados: clients.filter((client) => client.status === "bloqueado").length,
  };
}

function ensureValidUuid(clientId) {
  if (!isValidUuid(clientId)) {
    throw new HttpError(400, "Identificador de cliente invalido");
  }
}

function ensureFound(client) {
  if (!client) {
    throw new HttpError(404, "Cliente nao encontrado");
  }
}

async function list(req, res) {
  const clientes = await repository.listByUserId(req.user.id);
  res.json({ resumo: buildSummary(clientes), clientes });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const cliente = await repository.findById(req.user.id, req.params.id);
  ensureFound(cliente);
  res.json({ cliente });
}

async function create(req, res) {
  const { errors, data } = validateClientCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const cliente = await repository.create(req.user.id, data);
  res.status(201).json({ mensagem: "Cliente cadastrado com sucesso", cliente });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateClientUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const cliente = await repository.updateById(req.user.id, req.params.id, data);
  ensureFound(cliente);
  res.json({ mensagem: "Cliente atualizado com sucesso", cliente });
}

async function updateStatus(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateClientStatus(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const cliente = await repository.updateStatusById(req.user.id, req.params.id, data.status);
  ensureFound(cliente);
  res.json({ mensagem: "Status do cliente atualizado com sucesso", cliente });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const cliente = await repository.deleteById(req.user.id, req.params.id);
  ensureFound(cliente);
  res.json({ mensagem: "Cliente excluido com sucesso" });
}

module.exports = { page, list, show, create, update, updateStatus, remove };
