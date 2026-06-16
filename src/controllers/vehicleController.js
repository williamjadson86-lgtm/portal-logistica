const repository = require("../repositories/vehicleRepository");
const fleetCostRepository = require("../repositories/fleetCostRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateVehicleCreate,
  validateVehicleUpdate,
  validateVehicleStatus,
} = require("../validations/vehicleValidation");

function page(_req, res) {
  res.sendFile(resolveView("veiculos.html"));
}

function buildSummary(vehicles) {
  return {
    totalVeiculos: vehicles.length,
    disponiveis: vehicles.filter((vehicle) => vehicle.status === "disponivel").length,
    emRota: vehicles.filter((vehicle) => vehicle.status === "em_rota").length,
    manutencao: vehicles.filter((vehicle) => vehicle.status === "manutencao").length,
    inativos: vehicles.filter((vehicle) => vehicle.status === "inativo").length,
  };
}

function ensureValidUuid(vehicleId) {
  if (!isValidUuid(vehicleId)) {
    throw new HttpError(400, "Identificador de veiculo invalido");
  }
}

function ensureFound(vehicle) {
  if (!vehicle) {
    throw new HttpError(404, "Veiculo nao encontrado");
  }
}

async function list(req, res) {
  const veiculos = await repository.listByUserId(req.user);
  res.json({ resumo: buildSummary(veiculos), veiculos });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const veiculo = await repository.findById(req.user, req.params.id);
  ensureFound(veiculo);
  res.json({ veiculo });
}

async function listExpenses(req, res) {
  ensureValidUuid(req.params.id);
  const veiculo = await repository.findById(req.user, req.params.id);
  ensureFound(veiculo);

  const despesas = await fleetCostRepository.listByVehicleId(req.user, req.params.id);
  res.json({
    veiculo,
    resumo: {
      totalDespesas: despesas.length,
      totalPago: Number(
        despesas
          .filter((item) => item.status === "pago")
          .reduce((sum, item) => sum + item.valor, 0)
          .toFixed(2),
      ),
      totalPendente: Number(
        despesas
          .filter((item) => item.status === "pendente")
          .reduce((sum, item) => sum + item.valor, 0)
          .toFixed(2),
      ),
      valorTotal: Number(despesas.reduce((sum, item) => sum + item.valor, 0).toFixed(2)),
    },
    despesas,
  });
}

async function create(req, res) {
  const { errors, data } = validateVehicleCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const veiculo = await repository.create(req.user, data);
  res.status(201).json({ mensagem: "Veiculo cadastrado com sucesso", veiculo });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateVehicleUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const veiculo = await repository.updateById(req.user, req.params.id, data);
  ensureFound(veiculo);
  res.json({ mensagem: "Veiculo atualizado com sucesso", veiculo });
}

async function updateStatus(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateVehicleStatus(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const veiculo = await repository.updateStatusById(
    req.user,
    req.params.id,
    data.status,
  );
  ensureFound(veiculo);
  res.json({ mensagem: "Status do veiculo atualizado com sucesso", veiculo });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const veiculo = await repository.deleteById(req.user, req.params.id);
  ensureFound(veiculo);
  res.json({ mensagem: "Veiculo excluido com sucesso" });
}

module.exports = { page, list, show, listExpenses, create, update, updateStatus, remove };
