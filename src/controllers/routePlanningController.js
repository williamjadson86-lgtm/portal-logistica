const repository = require("../repositories/routePlanningRepository");
const eventRepository = require("../repositories/deliveryEventRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateRouteCreate,
  validateRouteUpdate,
  validateRouteDeliveries,
} = require("../validations/routePlanningValidation");

function page(_req, res) {
  res.sendFile(resolveView("rotas.html"));
}

function ensureValidUuid(value, label) {
  if (!isValidUuid(value)) {
    throw new HttpError(400, `Identificador de ${label} invalido`);
  }
}

async function registerDeliveryEvents(userId, events) {
  if (!events.length) {
    return;
  }

  await eventRepository.appendMany(
    events.map((event) => ({
      ...event,
      usuarioId: userId || null,
    })),
  );
}

async function list(req, res) {
  const [rotas, resumo, apoio] = await Promise.all([
    repository.listForUser(req.user),
    repository.getDashboardSummaryForUser(req.user),
    repository.getSupportDataForUser(req.user),
  ]);

  res.json({
    resumo: {
      totalRotas: resumo.total,
      planejadas: resumo.planejadas,
      emAndamento: resumo.emAndamento,
      concluidas: resumo.concluidas,
    },
    rotas,
    apoio,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const rota = await repository.findByIdForUser(req.user, req.params.id);

  if (!rota) {
    throw new HttpError(404, "Rota nao encontrada");
  }

  const apoio = await repository.getSupportDataForUser(req.user);
  res.json({ rota, apoio });
}

async function create(req, res) {
  const { errors, data } = validateRouteCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const result = await repository.create(req.user, data);
  res.status(201).json({ mensagem: "Rota cadastrada com sucesso", ...result });
}

async function update(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const { errors, data } = validateRouteUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const result = await repository.updateById(req.user, req.params.id, data);
  res.json({ mensagem: "Rota atualizada com sucesso", ...result });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const deleted = await repository.deleteById(req.user, req.params.id);

  if (!deleted) {
    throw new HttpError(404, "Rota nao encontrada");
  }

  res.json({ mensagem: "Rota excluida com sucesso" });
}

async function addDeliveries(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const { errors, data } = validateRouteDeliveries(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const result = await repository.addDeliveries(req.user, req.params.id, data.entregaIds);
  await registerDeliveryEvents(
    req.user?.id,
    result.rota.entregas
      .filter((entrega) => data.entregaIds.includes(entrega.id))
      .map((entrega) => ({
        entregaId: entrega.id,
        tipoEvento: "vinculada_rota",
        descricao: `Entrega ${entrega.codigo} vinculada a rota ${result.rota.codigo}`,
        dados: {
          rotaId: result.rota.id,
          rotaCodigo: result.rota.codigo,
          entregaCodigo: entrega.codigo,
        },
      })),
  );
  res.json({ mensagem: "Entregas vinculadas com sucesso", ...result });
}

async function removeDelivery(req, res) {
  ensureValidUuid(req.params.id, "rota");
  ensureValidUuid(req.params.entregaId, "entrega");
  const result = await repository.removeDelivery(
    req.user,
    req.params.id,
    req.params.entregaId,
  );
  const entrega = result.rota.entregas.find((item) => item.id === req.params.entregaId);
  await registerDeliveryEvents(req.user?.id, [
    {
      entregaId: req.params.entregaId,
      tipoEvento: "removida_rota",
      descricao: `Entrega ${entrega?.codigo || req.params.entregaId} removida da rota ${result.rota.codigo}`,
      dados: {
        rotaId: result.rota.id,
        rotaCodigo: result.rota.codigo,
        entregaCodigo: entrega?.codigo || null,
      },
    },
  ]);
  res.json({ mensagem: "Entrega removida da rota com sucesso", ...result });
}

async function start(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const result = await repository.startRoute(req.user, req.params.id);
  await registerDeliveryEvents(
    req.user?.id,
    result.rota.entregas.map((entrega) => ({
      entregaId: entrega.id,
      tipoEvento: "rota_iniciada",
      descricao: `Rota ${result.rota.codigo} iniciada para a entrega ${entrega.codigo}`,
      dados: {
        rotaId: result.rota.id,
        rotaCodigo: result.rota.codigo,
        entregaCodigo: entrega.codigo,
      },
    })),
  );
  res.json({ mensagem: "Rota iniciada com sucesso", ...result });
}

async function complete(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const result = await repository.completeRoute(req.user, req.params.id);
  await registerDeliveryEvents(
    req.user?.id,
    result.rota.entregas.map((entrega) => ({
      entregaId: entrega.id,
      tipoEvento: "rota_concluida",
      descricao: `Rota ${result.rota.codigo} concluida para a entrega ${entrega.codigo}`,
      dados: {
        rotaId: result.rota.id,
        rotaCodigo: result.rota.codigo,
        entregaCodigo: entrega.codigo,
      },
    })),
  );
  res.json({ mensagem: "Rota concluida com sucesso", ...result });
}

async function cancel(req, res) {
  ensureValidUuid(req.params.id, "rota");
  const result = await repository.cancelRoute(req.user, req.params.id);
  await registerDeliveryEvents(
    req.user?.id,
    result.rota.entregas.map((entrega) => ({
      entregaId: entrega.id,
      tipoEvento: "rota_cancelada",
      descricao: `Rota ${result.rota.codigo} cancelada para a entrega ${entrega.codigo}`,
      dados: {
        rotaId: result.rota.id,
        rotaCodigo: result.rota.codigo,
        entregaCodigo: entrega.codigo,
      },
    })),
  );
  res.json({ mensagem: "Rota cancelada com sucesso", ...result });
}

module.exports = {
  page,
  list,
  show,
  create,
  update,
  remove,
  addDeliveries,
  removeDelivery,
  start,
  complete,
  cancel,
};
