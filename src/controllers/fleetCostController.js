const HttpError = require("../errors/HttpError");
const repository = require("../repositories/fleetCostRepository");
const resolveView = require("../utils/viewResolver");
const { isValidUuid } = require("../validations/financialValidation");
const {
  validateVehicleExpenseCreate,
  validateVehicleExpenseFilters,
  validateVehicleExpenseUpdate,
} = require("../validations/fleetCostValidation");

function ensureValidUuid(expenseId) {
  if (!isValidUuid(expenseId)) {
    throw new HttpError(400, "Identificador de despesa invalido");
  }
}

function ensureFound(expense) {
  if (!expense) {
    throw new HttpError(404, "Despesa de veiculo nao encontrada");
  }
}

function page(_req, res) {
  res.sendFile(resolveView("custos-frota.html"));
}

function buildSummary(items) {
  const totals = items.reduce(
    (accumulator, item) => {
      accumulator.total += item.valor;
      if (item.status === "pago") {
        accumulator.pago += item.valor;
      }
      if (["pendente", "faturado"].includes(item.status)) {
        accumulator.pendente += item.valor;
      }
      if (item.dataVencimento && item.dataVencimento < new Date().toISOString().slice(0, 10)) {
        accumulator.vencidas += ["pendente", "faturado"].includes(item.status) ? 1 : 0;
      }
      if (item.integrarFinanceiro) {
        accumulator.integradas += 1;
      } else {
        accumulator.internas += 1;
      }
      accumulator.porTipo[item.tipo] = Number(
        ((accumulator.porTipo[item.tipo] || 0) + item.valor).toFixed(2),
      );
      return accumulator;
    },
    {
      total: 0,
      pago: 0,
      pendente: 0,
      vencidas: 0,
      integradas: 0,
      internas: 0,
      porTipo: {},
    },
  );

  return {
    totalDespesas: Number(totals.total.toFixed(2)),
    totalPago: Number(totals.pago.toFixed(2)),
    totalPendente: Number(totals.pendente.toFixed(2)),
    totalVencidas: totals.vencidas,
    totalIntegradasFinanceiro: totals.integradas,
    totalControleInterno: totals.internas,
    porTipo: totals.porTipo,
  };
}

async function list(req, res) {
  const { errors, data } = validateVehicleExpenseFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const [despesas, apoio] = await Promise.all([
    repository.listByUserId(req.user, data),
    repository.listSupportData(req.user),
  ]);

  res.json({
    resumo: buildSummary(despesas),
    filtrosAplicados: data,
    apoio,
    despesas,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const expense = await repository.findById(req.user, req.params.id);
  ensureFound(expense);
  res.json({ despesa: expense });
}

async function create(req, res) {
  const { errors, data } = validateVehicleExpenseCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const expense = await repository.create(req.user, data);
  res.status(201).json({
    mensagem: "Despesa de veiculo criada com sucesso",
    despesa: expense,
  });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateVehicleExpenseUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const expense = await repository.updateById(req.user, req.params.id, data);
  ensureFound(expense);
  res.json({
    mensagem: "Despesa de veiculo atualizada com sucesso",
    despesa: expense,
  });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const expense = await repository.deleteById(req.user, req.params.id);
  ensureFound(expense);
  res.json({
    mensagem: "Despesa de veiculo cancelada com sucesso",
    despesa: expense,
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
