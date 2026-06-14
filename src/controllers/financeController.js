const repository = require("../repositories/financeRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateFinancialCreate,
  validateFinancialFilters,
  validateFinancialStatusUpdate,
  validateFinancialUpdate,
} = require("../validations/financialValidation");

function page(_req, res) {
  res.sendFile(resolveView("financeiro.html"));
}

function ensureValidUuid(financialId) {
  if (!isValidUuid(financialId)) {
    throw new HttpError(400, "Identificador financeiro invalido");
  }
}

function ensureFound(entry) {
  if (!entry) {
    throw new HttpError(404, "Lancamento financeiro nao encontrado");
  }
}

function buildSummary(entries) {
  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator.total += entry.valor;
      accumulator[entry.status] += entry.valor;
      if (entry.tipo === "receita" && entry.status !== "cancelado") {
        accumulator.receitaTotal += entry.valor;
      }
      return accumulator;
    },
    {
      total: 0,
      pendente: 0,
      faturado: 0,
      pago: 0,
      cancelado: 0,
      receitaTotal: 0,
    },
  );

  return {
    totalLancamentos: entries.length,
    totalPendente: Number(totals.pendente.toFixed(2)),
    totalFaturado: Number(totals.faturado.toFixed(2)),
    totalPago: Number(totals.pago.toFixed(2)),
    totalCancelado: Number(totals.cancelado.toFixed(2)),
    receitaTotalPeriodo: Number(totals.receitaTotal.toFixed(2)),
    valorTotal: Number(totals.total.toFixed(2)),
  };
}

async function list(req, res) {
  const { errors, data } = validateFinancialFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const [entries, supportData] = await Promise.all([
    repository.listByUserId(req.user, data),
    repository.listSupportData(req.user),
  ]);

  res.json({
    resumo: buildSummary(entries),
    filtrosAplicados: data,
    apoio: supportData,
    lancamentos: entries,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id);
  const entry = await repository.findById(req.user, req.params.id);
  ensureFound(entry);
  res.json({ lancamento: entry });
}

async function create(req, res) {
  const { errors, data } = validateFinancialCreate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const entry = await repository.create(req.user, data);
  res.status(201).json({
    mensagem: "Lancamento financeiro criado com sucesso",
    lancamento: entry,
  });
}

async function update(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateFinancialUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const entry = await repository.updateById(req.user, req.params.id, data);
  ensureFound(entry);
  res.json({
    mensagem: "Lancamento financeiro atualizado com sucesso",
    lancamento: entry,
  });
}

async function updateStatus(req, res) {
  ensureValidUuid(req.params.id);
  const { errors, data } = validateFinancialStatusUpdate(req.body);
  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const entry = await repository.updateStatusById(
    req.user,
    req.params.id,
    data.status,
    data.dataPagamento,
  );
  ensureFound(entry);
  res.json({
    mensagem: "Status do lancamento atualizado com sucesso",
    lancamento: entry,
  });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id);
  const entry = await repository.cancelById(req.user, req.params.id);
  ensureFound(entry);
  res.json({
    mensagem: "Lancamento financeiro cancelado com sucesso",
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
};
