const HttpError = require("../errors/HttpError");
const repository = require("../repositories/vehicleMaintenanceRepository");
const resolveView = require("../utils/viewResolver");
const { isValidUuid } = require("../validations/financialValidation");
const {
  validateVehicleMaintenanceCreate,
  validateVehicleMaintenanceFilters,
  validateVehicleMaintenanceUpdate,
} = require("../validations/vehicleMaintenanceValidation");

function ensureValidUuid(maintenanceId) {
  if (!isValidUuid(maintenanceId)) {
    throw new HttpError(400, "Identificador de manutencao invalido");
  }
}

function ensureFound(maintenance) {
  if (!maintenance) {
    throw new HttpError(404, "Manutencao de veiculo nao encontrada");
  }
}

function page(_req, res) {
  res.sendFile(resolveView("manutencoes-veiculos.html"));
}

function buildSummary(items) {
  const hoje = new Date().toISOString().slice(0, 10);
  const totals = items.reduce(
    (accumulator, item) => {
      accumulator.total += item.custo;
      accumulator.totalRegistros += 1;
      accumulator[item.status] += 1;
      if (
        item.proximaManutencao &&
        item.proximaManutencao < hoje &&
        ["agendada", "em_execucao"].includes(item.status)
      ) {
        accumulator.vencidas += 1;
      }
      if (item.integrarFinanceiro) {
        accumulator.integradas += 1;
      } else {
        accumulator.internas += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      totalRegistros: 0,
      agendada: 0,
      em_execucao: 0,
      concluida: 0,
      cancelada: 0,
      vencidas: 0,
      integradas: 0,
      internas: 0,
    },
  );

  return {
    totalCusto: Number(totals.total.toFixed(2)),
    totalRegistros: totals.totalRegistros,
    agendadas: totals.agendada,
    emExecucao: totals.em_execucao,
    concluidas: totals.concluida,
    canceladas: totals.cancelada,
    manutencoesVencidas: totals.vencidas,
    totalIntegradasFinanceiro: totals.integradas,
    totalControleInterno: totals.internas,
  };
}

async function list(req, res) {
  const { errors, data } = validateVehicleMaintenanceFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const [manutencoes, apoio] = await Promise.all([
    repository.listByUserId(req.user, data),
    repository.listSupportData(req.user),
  ]);

  res.json({
    resumo: buildSummary(manutencoes),
    filtrosAplicados: data,
    apoio,
    manutencoes,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const maintenance = await repository.findById(req.user, req.params.id);
  ensureFound(maintenance);
  res.json({ manutencao: maintenance });
}

async function create(req, res) {
  const { errors, data } = validateVehicleMaintenanceCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const maintenance = await repository.create(req.user, data);
  res.status(201).json({
    mensagem: "Manutencao de veiculo criada com sucesso",
    manutencao: maintenance,
  });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateVehicleMaintenanceUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const maintenance = await repository.updateById(req.user, req.params.id, data);
  ensureFound(maintenance);
  res.json({
    mensagem: "Manutencao de veiculo atualizada com sucesso",
    manutencao: maintenance,
  });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const maintenance = await repository.deleteById(req.user, req.params.id);
  ensureFound(maintenance);
  res.json({
    mensagem: "Manutencao de veiculo cancelada com sucesso",
    manutencao: maintenance,
  });
}

module.exports = {
  page,
  list,
  show,
  create,
  update,
  remove,
  buildSummary,
};
