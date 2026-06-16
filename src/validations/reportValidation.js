const { DELIVERY_STATUSES, isValidUuid } = require("./deliveryValidation");
const { FINANCIAL_STATUSES, FINANCIAL_TYPES } = require("./financialValidation");
const { VEHICLE_EXPENSE_TYPES } = require("./fleetCostValidation");

const REPORT_EXPORT_TYPES = ["resumo", "entregas", "financeiro", "frota"];
const REPORT_EXPORT_FORMATS = ["csv", "xlsx"];
const REPORT_STATUSES = [...new Set([...DELIVERY_STATUSES, ...FINANCIAL_STATUSES, "agendada", "em_execucao", "concluida"])];
const REPORT_TYPES = [...new Set([...FINANCIAL_TYPES, ...VEHICLE_EXPENSE_TYPES, "preventiva", "corretiva"])];

function parseOptionalText(value) {
  if (value == null || value === "") {
    return null;
  }

  return String(value).trim();
}

function readFirst(input, keys) {
  for (const key of keys) {
    if (Object.hasOwn(input, key)) {
      return input[key];
    }
  }

  return undefined;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateCommonReportFilters(input, options = {}) {
  const { skipTipoField = false } = options;
  const errors = [];
  const data = {};

  const clienteId = parseOptionalText(readFirst(input, ["clienteId", "cliente_id"]));
  if (clienteId !== null) {
    if (!isValidUuid(clienteId)) {
      errors.push("clienteId invalido");
    } else {
      data.clienteId = clienteId;
    }
  } else {
    data.clienteId = null;
  }

  const veiculoId = parseOptionalText(readFirst(input, ["veiculoId", "veiculo_id"]));
  if (veiculoId !== null) {
    if (!isValidUuid(veiculoId)) {
      errors.push("veiculoId invalido");
    } else {
      data.veiculoId = veiculoId;
    }
  } else {
    data.veiculoId = null;
  }

  const motoristaId = parseOptionalText(readFirst(input, ["motoristaId", "motorista_id"]));
  if (motoristaId !== null) {
    if (!isValidUuid(motoristaId)) {
      errors.push("motoristaId invalido");
    } else {
      data.motoristaId = motoristaId;
    }
  } else {
    data.motoristaId = null;
  }

  const dataInicio = parseOptionalText(readFirst(input, ["dataInicio", "data_inicio"]));
  const dataFim = parseOptionalText(readFirst(input, ["dataFim", "data_fim"]));

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

  const status = parseOptionalText(readFirst(input, ["status", "statusEntrega", "statusFinanceiro"]));
  if (status !== null) {
    if (!REPORT_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  } else {
    data.status = null;
  }

  if (skipTipoField) {
    data.tipo = null;
  } else {
    const tipo = parseOptionalText(readFirst(input, ["tipo", "tipoRelatorio"]));
    if (tipo !== null) {
      if (!REPORT_TYPES.includes(tipo)) {
        errors.push("tipo invalido");
      } else {
        data.tipo = tipo;
      }
    } else {
      data.tipo = null;
    }
  }

  return { errors, data };
}

function validateClientReportFilters(input) {
  const { errors, data } = validateCommonReportFilters(input);
  data.statusEntrega = data.status && DELIVERY_STATUSES.includes(data.status) ? data.status : null;
  data.statusFinanceiro = data.status && FINANCIAL_STATUSES.includes(data.status) ? data.status : null;
  return { errors, data };
}

function validateReportExport(input) {
  const { errors, data } = validateCommonReportFilters(input, { skipTipoField: true });
  const tipo = parseOptionalText(input.tipo);
  const formato = parseOptionalText(input.formato);

  if (!REPORT_EXPORT_TYPES.includes(tipo || "")) {
    errors.push("tipo de exportacao invalido");
  } else {
    data.tipoExportacao = tipo;
  }

  if (!REPORT_EXPORT_FORMATS.includes(formato || "")) {
    errors.push("formato invalido");
  } else {
    data.formato = formato;
  }

  return { errors, data };
}

module.exports = {
  REPORT_EXPORT_TYPES,
  REPORT_EXPORT_FORMATS,
  validateCommonReportFilters,
  validateClientReportFilters,
  validateReportExport,
};
