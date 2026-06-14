const repository = require("../repositories/driverRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateDriverCreate,
  validateDriverUpdate,
  validateDriverStatus,
} = require("../validations/driverValidation");

function page(_req, res) {
  res.sendFile(resolveView("motoristas.html"));
}

function buildSummary(drivers) {
  return {
    totalMotoristas: drivers.length,
    ativos: drivers.filter((driver) => driver.status === "ativo").length,
    inativos: drivers.filter((driver) => driver.status === "inativo").length,
    afastados: drivers.filter((driver) => driver.status === "afastado").length,
  };
}

function ensureValidUuid(driverId) {
  if (!isValidUuid(driverId)) {
    throw new HttpError(400, "Identificador de motorista invalido");
  }
}

function ensureFound(driver) {
  if (!driver) {
    throw new HttpError(404, "Motorista nao encontrado");
  }
}

async function list(req, res) {
  const motoristas = await repository.listByUserId(req.user);
  res.json({ resumo: buildSummary(motoristas), motoristas });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const motorista = await repository.findById(req.user, req.params.id);
  ensureFound(motorista);
  res.json({ motorista });
}

async function create(req, res) {
  const { errors, data } = validateDriverCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const motorista = await repository.create(req.user, data);
  res.status(201).json({ mensagem: "Motorista cadastrado com sucesso", motorista });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateDriverUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const motorista = await repository.updateById(req.user, req.params.id, data);
  ensureFound(motorista);
  res.json({ mensagem: "Motorista atualizado com sucesso", motorista });
}

async function updateStatus(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateDriverStatus(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const motorista = await repository.updateStatusById(
    req.user,
    req.params.id,
    data.status,
  );
  ensureFound(motorista);
  res.json({ mensagem: "Status do motorista atualizado com sucesso", motorista });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const motorista = await repository.deleteById(req.user, req.params.id);
  ensureFound(motorista);
  res.json({ mensagem: "Motorista excluido com sucesso" });
}

module.exports = { page, list, show, create, update, updateStatus, remove };
