const repository = require("../repositories/deliveryRepository");
const eventRepository = require("../repositories/deliveryEventRepository");
const financeRepository = require("../repositories/financeRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateDeliveryCreate,
  validateDeliveryUpdate,
  validateDeliveryStatusUpdate,
} = require("../validations/deliveryValidation");
const { validateFinancialCreateFromDelivery } = require("../validations/financialValidation");

function page(_req, res) {
  res.sendFile(resolveView("entregas.html"));
}

function buildSummary(deliveries) {
  return {
    totalEntregas: deliveries.length,
    pendentes: deliveries.filter((delivery) => delivery.status === "pendente").length,
    emTransito: deliveries.filter((delivery) => delivery.status === "em_transito").length,
    emRota: deliveries.filter((delivery) => delivery.status === "em_rota").length,
    entregues: deliveries.filter((delivery) => delivery.status === "entregue").length,
    canceladas: deliveries.filter((delivery) => delivery.status === "cancelada").length,
  };
}

function ensureValidUuid(deliveryId) {
  if (!isValidUuid(deliveryId)) {
    throw new HttpError(400, "Identificador de entrega invalido");
  }
}

function ensureFound(delivery) {
  if (!delivery) {
    throw new HttpError(404, "Entrega nao encontrada");
  }
}

async function list(req, res) {
  const deliveries = await repository.listForUser(req.user);

  res.json({
    resumo: buildSummary(deliveries),
    entregas: deliveries,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const delivery = await repository.findByIdForUser(req.user, req.params.id);
  ensureFound(delivery);

  res.json({ entrega: delivery });
}

async function create(req, res) {
  const { errors, data } = validateDeliveryCreate(req.body);

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const delivery = await repository.create(req.user, data);
  await eventRepository.appendEvent({
    actor: req.user,
    entregaId: delivery.id,
    usuarioId: req.user?.id || null,
    empresaId: req.user?.empresaId || null,
    tipoEvento: "entrega_criada",
    descricao: `Entrega ${delivery.codigo} cadastrada para ${delivery.cliente}`,
    dados: {
      codigo: delivery.codigo,
      clienteId: delivery.clienteId || null,
      cliente: delivery.cliente,
      status: delivery.status,
    },
  });

  res.status(201).json({
    mensagem: "Entrega cadastrada com sucesso",
    entrega: delivery,
  });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateDeliveryUpdate(req.body);

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const delivery = await repository.updateById(req.user, req.params.id, data);
  ensureFound(delivery);

  if (delivery.status === "cancelada") {
    await financeRepository.cancelPendingByDeliveryId(req.user, delivery.id);
  }

  await eventRepository.appendEvent({
    actor: req.user,
    entregaId: delivery.id,
    usuarioId: req.user?.id || null,
    empresaId: req.user?.empresaId || null,
    tipoEvento: "entrega_atualizada",
    descricao: `Entrega ${delivery.codigo} atualizada`,
    dados: {
      codigo: delivery.codigo,
      camposAtualizados: Object.keys(data),
    },
  });

  res.json({
    mensagem: "Entrega atualizada com sucesso",
    entrega: delivery,
  });
}

async function updateStatus(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateDeliveryStatusUpdate(req.body);

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const delivery = await repository.updateStatusById(req.user, req.params.id, data.status);
  ensureFound(delivery);

  if (delivery.status === "cancelada") {
    await financeRepository.cancelPendingByDeliveryId(req.user, delivery.id);
  }

  await eventRepository.appendEvent({
    actor: req.user,
    entregaId: delivery.id,
    usuarioId: req.user?.id || null,
    empresaId: req.user?.empresaId || null,
    tipoEvento: "status_alterado",
    descricao: `Status da entrega ${delivery.codigo} alterado para ${delivery.status}`,
    dados: {
      codigo: delivery.codigo,
      status: delivery.status,
    },
  });

  res.json({
    mensagem: "Status da entrega atualizado com sucesso",
    entrega: delivery,
  });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const delivery = await repository.deleteById(req.user, req.params.id);
  ensureFound(delivery);

  res.json({
    mensagem: "Entrega excluida com sucesso",
  });
}

async function createFinancialEntry(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateFinancialCreateFromDelivery({
    ...req.body,
    entregaId: req.params.id,
  });

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const entry = await financeRepository.createFromDelivery(req.user, req.params.id, data);

  res.status(201).json({
    mensagem: "Lancamento financeiro gerado com sucesso",
    lancamento: entry,
  });
}

module.exports = {
  page,
  list,
  show,
  create,
  update,
  updateStatus,
  remove,
  createFinancialEntry,
};
