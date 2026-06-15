const FINANCIAL_TYPES = ["receita", "despesa", "repasse"];
const FINANCIAL_STATUSES = ["pendente", "faturado", "pago", "cancelado"];
const CASH_FLOW_PERIODS = ["today", "7d", "30d", "month", "custom"];

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalText(value) {
  if (value == null || value === "") {
    return null;
  }

  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
}

function validateFinancialPayload(input, options = {}) {
  const { partial = false, requireLinkedDelivery = false } = options;
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "clienteId")) {
    const clienteId = parseOptionalText(input.clienteId);
    if (clienteId !== null && !isValidUuid(clienteId)) {
      errors.push("clienteId invalido");
    } else {
      data.clienteId = clienteId;
    }
  }

  if (Object.hasOwn(input, "entregaId")) {
    const entregaId = parseOptionalText(input.entregaId);
    if (entregaId !== null && !isValidUuid(entregaId)) {
      errors.push("entregaId invalido");
    } else {
      data.entregaId = entregaId;
    }
  } else if (!partial && requireLinkedDelivery) {
    errors.push("entregaId e obrigatorio");
  }

  const tipo = parseText(input.tipo);
  if (Object.hasOwn(input, "tipo")) {
    if (!FINANCIAL_TYPES.includes(tipo)) {
      errors.push("tipo invalido");
    } else {
      data.tipo = tipo;
    }
  } else if (!partial) {
    data.tipo = "receita";
  }

  const descricao = parseText(input.descricao);
  if (Object.hasOwn(input, "descricao")) {
    if (descricao.length < 3 || descricao.length > 160) {
      errors.push("descricao deve ter entre 3 e 160 caracteres");
    } else {
      data.descricao = descricao;
    }
  } else if (!partial && !requireLinkedDelivery) {
    errors.push("descricao e obrigatoria");
  }

  if (Object.hasOwn(input, "valor")) {
    const valor = parseAmount(input.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      errors.push("valor deve ser maior que zero");
    } else {
      data.valor = valor;
    }
  } else if (!partial && !requireLinkedDelivery) {
    errors.push("valor e obrigatorio");
  }

  const status = parseText(input.status);
  if (Object.hasOwn(input, "status")) {
    if (!FINANCIAL_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  } else if (!partial) {
    data.status = "pendente";
  }

  const dataCompetencia = parseOptionalText(input.dataCompetencia);
  if (Object.hasOwn(input, "dataCompetencia")) {
    if (dataCompetencia !== null && !isValidDate(dataCompetencia)) {
      errors.push("dataCompetencia deve estar no formato YYYY-MM-DD");
    } else {
      data.dataCompetencia = dataCompetencia;
    }
  } else if (!partial) {
    data.dataCompetencia = new Date().toISOString().slice(0, 10);
  }

  const dataVencimento = parseOptionalText(input.dataVencimento);
  if (Object.hasOwn(input, "dataVencimento")) {
    if (dataVencimento !== null && !isValidDate(dataVencimento)) {
      errors.push("dataVencimento deve estar no formato YYYY-MM-DD");
    } else {
      data.dataVencimento = dataVencimento;
    }
  }

  const dataPagamento = parseOptionalText(input.dataPagamento);
  if (Object.hasOwn(input, "dataPagamento")) {
    if (dataPagamento !== null && !isValidDate(dataPagamento)) {
      errors.push("dataPagamento deve estar no formato YYYY-MM-DD");
    } else {
      data.dataPagamento = dataPagamento;
    }
  }

  const observacoes = parseOptionalText(input.observacoes);
  if (Object.hasOwn(input, "observacoes")) {
    if (observacoes !== null && observacoes.length > 2000) {
      errors.push("observacoes deve ter no maximo 2000 caracteres");
    } else {
      data.observacoes = observacoes;
    }
  } else if (!partial) {
    data.observacoes = null;
  }

  if (
    data.dataCompetencia &&
    data.dataVencimento &&
    data.dataCompetencia > data.dataVencimento
  ) {
    errors.push("dataCompetencia nao pode ser maior que dataVencimento");
  }

  if (data.status === "pago" && Object.hasOwn(data, "dataPagamento") && data.dataPagamento === null) {
    errors.push("dataPagamento e obrigatoria para status pago");
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

function validateFinancialStatusUpdate(input) {
  const errors = [];
  const status = parseText(input.status);
  const dataPagamento = parseOptionalText(input.dataPagamento);

  if (!FINANCIAL_STATUSES.includes(status)) {
    errors.push("status invalido");
  }

  if (dataPagamento !== null && !isValidDate(dataPagamento)) {
    errors.push("dataPagamento deve estar no formato YYYY-MM-DD");
  }

  return {
    errors,
    data: errors.length ? {} : { status, dataPagamento },
  };
}

function validateFinancialFilters(input) {
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "status") && input.status !== "") {
    const status = parseText(input.status);
    if (!FINANCIAL_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  }

  if (Object.hasOwn(input, "tipo") && input.tipo !== "") {
    const tipo = parseText(input.tipo);
    if (!FINANCIAL_TYPES.includes(tipo)) {
      errors.push("tipo invalido");
    } else {
      data.tipo = tipo;
    }
  }

  if (Object.hasOwn(input, "clienteId") && input.clienteId !== "") {
    if (!isValidUuid(input.clienteId)) {
      errors.push("clienteId invalido");
    } else {
      data.clienteId = input.clienteId;
    }
  }

  if (Object.hasOwn(input, "dataInicio") && input.dataInicio !== "") {
    if (!isValidDate(input.dataInicio)) {
      errors.push("dataInicio deve estar no formato YYYY-MM-DD");
    } else {
      data.dataInicio = input.dataInicio;
    }
  }

  if (Object.hasOwn(input, "dataFim") && input.dataFim !== "") {
    if (!isValidDate(input.dataFim)) {
      errors.push("dataFim deve estar no formato YYYY-MM-DD");
    } else {
      data.dataFim = input.dataFim;
    }
  }

  if (data.dataInicio && data.dataFim && data.dataInicio > data.dataFim) {
    errors.push("dataInicio nao pode ser maior que dataFim");
  }

  return { errors, data };
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(referenceDate, days) {
  const date = new Date(referenceDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function validateCashFlowFilters(input, referenceDate = new Date()) {
  const errors = [];
  const data = {};
  const periodo = parseText(input.periodo) || "7d";

  if (!CASH_FLOW_PERIODS.includes(periodo)) {
    errors.push("periodo invalido");
  }

  const today = new Date(`${formatDate(referenceDate)}T00:00:00Z`);
  let dataInicio = null;
  let dataFim = null;

  if (periodo === "custom") {
    dataInicio = parseOptionalText(input.dataInicio);
    dataFim = parseOptionalText(input.dataFim);

    if (!dataInicio || !dataFim) {
      errors.push("dataInicio e dataFim devem ser informadas para periodo custom");
    }
  } else if (periodo === "today") {
    dataInicio = formatDate(today);
    dataFim = formatDate(today);
  } else if (periodo === "7d") {
    dataInicio = formatDate(shiftDays(today, -6));
    dataFim = formatDate(today);
  } else if (periodo === "30d") {
    dataInicio = formatDate(shiftDays(today, -29));
    dataFim = formatDate(today);
  } else if (periodo === "month") {
    const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    dataInicio = formatDate(firstDay);
    dataFim = formatDate(lastDay);
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

  data.periodo = periodo;
  data.dataInicio = dataInicio;
  data.dataFim = dataFim;
  data.hoje = formatDate(today);

  return { errors, data };
}

module.exports = {
  FINANCIAL_TYPES,
  FINANCIAL_STATUSES,
  CASH_FLOW_PERIODS,
  isValidUuid,
  validateFinancialCreate: (input) => validateFinancialPayload(input),
  validateFinancialUpdate: (input) => validateFinancialPayload(input, { partial: true }),
  validateFinancialStatusUpdate,
  validateFinancialFilters,
  validateCashFlowFilters,
  validateFinancialCreateFromDelivery: (input) =>
    validateFinancialPayload(input, { requireLinkedDelivery: true }),
};
