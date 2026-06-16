const HttpError = require("../errors/HttpError");
const repository = require("../repositories/companyRepository");
const {
  isValidUuid,
  validateCompanyCreate,
  validateCompanyUpdate,
} = require("../validations/companyValidation");

function ensureValidUuid(value) {
  if (!isValidUuid(value)) {
    throw new HttpError(400, "Identificador de empresa invalido");
  }
}

function ensureFound(company) {
  if (!company) {
    throw new HttpError(404, "Empresa nao encontrada");
  }
}

async function list(req, res) {
  const empresas = await repository.listByActor(req.user);
  res.json({ empresas });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const empresa = await repository.findByIdForActor(req.user, req.params.id);
  ensureFound(empresa);
  res.json({ empresa });
}

async function create(req, res) {
  const { errors, data } = validateCompanyCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const empresa = await repository.createForActor(req.user, data);
  res.status(201).json({
    mensagem: "Empresa criada com sucesso",
    empresa,
  });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateCompanyUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const empresa = await repository.updateByIdForActor(req.user, req.params.id, data);
  ensureFound(empresa);
  res.json({
    mensagem: "Empresa atualizada com sucesso",
    empresa,
  });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const empresa = await repository.deleteByIdForActor(req.user, req.params.id);
  ensureFound(empresa);
  res.json({
    mensagem: "Empresa inativada com sucesso",
    empresa,
  });
}

module.exports = {
  list,
  show,
  create,
  update,
  remove,
};
