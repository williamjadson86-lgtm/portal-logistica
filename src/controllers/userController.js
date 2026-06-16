const HttpError = require("../errors/HttpError");
const repository = require("../repositories/userRepository");
const {
  validateManagedUserCreate,
  validateManagedUserUpdate,
  validateManagedUserStatus,
  validateManagedUserRole,
  validateResetPassword,
} = require("../validations/userValidation");
const { isValidUuid } = require("../validations/clientValidation");

function ensureValidUuid(userId) {
  if (!isValidUuid(userId)) {
    throw new HttpError(400, "Identificador de usuario invalido");
  }
}

function ensureFound(user) {
  if (!user) {
    throw new HttpError(404, "Usuario nao encontrado");
  }
}

async function me(req, res) {
  res.json({ usuario: req.user });
}

async function list(req, res) {
  const users = await repository.listByActor(req.user);
  res.json({
    resumo: {
      total: users.length,
      ativos: users.filter((user) => user.ativo).length,
      bloqueados: users.filter((user) => !user.ativo).length,
    },
    usuarios: users,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const user = await repository.findByIdForActor(req.user, req.params.id);
  ensureFound(user);
  res.json({ usuario: user });
}

async function create(req, res) {
  const { errors, data } = validateManagedUserCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const user = await repository.createManagedUser(req.user, data);
  res.status(201).json({
    mensagem: "Usuario criado com sucesso",
    usuario: user,
  });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateManagedUserUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const user = await repository.updateByIdForActor(req.user, req.params.id, data);
  ensureFound(user);
  res.json({
    mensagem: "Usuario atualizado com sucesso",
    usuario: user,
  });
}

async function updateStatus(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateManagedUserStatus(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const user = await repository.updateStatusByIdForActor(req.user, req.params.id, data.status);
  ensureFound(user);
  res.json({
    mensagem: "Status do usuario atualizado com sucesso",
    usuario: user,
  });
}

async function updateRole(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateManagedUserRole(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const user = await repository.updateRoleByIdForActor(req.user, req.params.id, data.tipoUsuario);
  ensureFound(user);
  res.json({
    mensagem: "Perfil do usuario atualizado com sucesso",
    usuario: user,
  });
}

async function resetPassword(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateResetPassword(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const user = await repository.resetPasswordByIdForActor(req.user, req.params.id, data.novaSenha);
  ensureFound(user);
  res.json({
    mensagem: "Senha redefinida com sucesso",
    usuario: user,
  });
}

module.exports = {
  me,
  list,
  show,
  create,
  update,
  updateStatus,
  updateRole,
  resetPassword,
};
