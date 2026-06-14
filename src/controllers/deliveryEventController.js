const HttpError = require("../errors/HttpError");
const deliveryRepository = require("../repositories/deliveryRepository");
const eventRepository = require("../repositories/deliveryEventRepository");
const { isValidUuid } = require("../validations/deliveryValidation");

function ensureValidUuid(deliveryId) {
  if (!isValidUuid(deliveryId)) {
    throw new HttpError(400, "Identificador de entrega invalido");
  }
}

async function list(req, res) {
  ensureValidUuid(req.params.id);

  const delivery = await deliveryRepository.findByIdForUser(req.user, req.params.id);
  if (!delivery) {
    throw new HttpError(404, "Entrega nao encontrada");
  }

  const eventos = await eventRepository.listByDeliveryId(req.user.id, req.params.id);
  res.json({ eventos });
}

module.exports = {
  list,
};
