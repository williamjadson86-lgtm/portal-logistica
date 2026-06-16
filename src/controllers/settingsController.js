const repository = require("../repositories/settingsRepository");
const userRepository = require("../repositories/userRepository");
const resolveView = require("../utils/viewResolver");
const HttpError = require("../errors/HttpError");
const { validateSettingsUpdate } = require("../validations/settingsValidation");

function page(_req, res) {
  res.sendFile(resolveView("configuracoes.html"));
}

async function data(req, res) {
  const [settings, users, permissions] = await Promise.all([
    repository.findByUserId(req.user),
    userRepository.listByActor(req.user),
    repository.listPermissions(),
  ]);

  res.json({
    usuario: req.user,
    empresa: settings.empresa,
    configuracoes: settings.configuracoes,
    usuarios: users,
    resumoUsuarios: settings.resumoUsuarios,
    permissoes: permissions,
  });
}

async function update(req, res) {
  const { errors, data } = validateSettingsUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const settings = await repository.updateByUserId(req.user, data);
  res.json({
    mensagem: "Configuracoes atualizadas com sucesso",
    configuracoes: settings.configuracoes,
  });
}

async function permissions(req, res) {
  res.json(repository.listPermissions());
}

module.exports = {
  page,
  data,
  update,
  permissions,
};
