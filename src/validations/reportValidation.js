const { DELIVERY_STATUSES, isValidUuid } = require("./deliveryValidation");
const { FINANCIAL_STATUSES } = require("./financialValidation");

function parseOptionalText(value) {
  if (value == null || value === "") {
    return null;
  }

  return String(value).trim();
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateClientReportFilters(input) {
  const errors = [];
  const data = {};

  const clienteId = parseOptionalText(input.clienteId);
  if (clienteId !== null) {
    if (!isValidUuid(clienteId)) {
      errors.push("clienteId invalido");
    } else {
      data.clienteId = clienteId;
    }
  } else {
    data.clienteId = null;
  }

  const dataInicio = parseOptionalText(input.dataInicio);
  const dataFim = parseOptionalText(input.dataFim);

  if ((dataInicio && !dataFim) || (!dataInicio && dataFim)) {
    errors.push("dataInicio e dataFim devem ser informadas em conjunto");
  }

  if (dataInicio && !isValidDate(dataInicio)) {
    errors.push("dataInicio deve estar no formato YYYY-MM-DD");
  }

  if (dataFim && !isValidDate(dataFim)) {
    errors.push("dataFim deve estar no formato YYYY-MM-DD");
  }

  if (dataInicio && dataFim && dataInicio > dataFim) {
    errors.push("dataInicio nao pode ser maior que dataFim");
  }

  data.dataInicio = dataInicio;
  data.dataFim = dataFim;

  const statusEntrega = parseOptionalText(input.statusEntrega);
  if (statusEntrega !== null) {
    if (!DELIVERY_STATUSES.includes(statusEntrega)) {
      errors.push("statusEntrega invalido");
    } else {
      data.statusEntrega = statusEntrega;
    }
  } else {
    data.statusEntrega = null;
  }

  const statusFinanceiro = parseOptionalText(input.statusFinanceiro);
  if (statusFinanceiro !== null) {
    if (!FINANCIAL_STATUSES.includes(statusFinanceiro)) {
      errors.push("statusFinanceiro invalido");
    } else {
      data.statusFinanceiro = statusFinanceiro;
    }
  } else {
    data.statusFinanceiro = null;
  }

  return { errors, data };
}

module.exports = {
  validateClientReportFilters,
};
