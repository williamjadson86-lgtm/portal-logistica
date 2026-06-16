const { isValidUuid } = require("./financialValidation");

const VEHICLE_EXPENSE_TYPES = [
  "abastecimento",
  "pedagio",
  "manutencao",
  "seguro",
  "multa",
  "outros",
];

const VEHICLE_EXPENSE_STATUSES = ["pendente", "pago", "cancelado"];

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

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return null;
}

function validateVehicleExpensePayload(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "veiculoId")) {
    const veiculoId = parseOptionalText(input.veiculoId);
    if (!veiculoId || !isValidUuid(veiculoId)) {
      errors.push("veiculoId invalido");
    } else {
      data.veiculoId = veiculoId;
    }
  } else if (!partial) {
    errors.push("veiculoId e obrigatorio");
  }

  if (Object.hasOwn(input, "motoristaId")) {
    const motoristaId = parseOptionalText(input.motoristaId);
    if (motoristaId !== null && !isValidUuid(motoristaId)) {
      errors.push("motoristaId invalido");
    } else {
      data.motoristaId = motoristaId;
    }
  } else if (!partial) {
    data.motoristaId = null;
  }

  if (Object.hasOwn(input, "tipo")) {
    const tipo = parseText(input.tipo);
    if (!VEHICLE_EXPENSE_TYPES.includes(tipo)) {
      errors.push("tipo invalido");
    } else {
      data.tipo = tipo;
    }
  } else if (!partial) {
    errors.push("tipo e obrigatorio");
  }

  if (Object.hasOwn(input, "descricao")) {
    const descricao = parseText(input.descricao);
    if (descricao.length < 3 || descricao.length > 160) {
      errors.push("descricao deve ter entre 3 e 160 caracteres");
    } else {
      data.descricao = descricao;
    }
  } else if (!partial) {
    errors.push("descricao e obrigatoria");
  }

  if (Object.hasOwn(input, "valor")) {
    const valor = parseAmount(input.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      errors.push("valor deve ser maior que zero");
    } else {
      data.valor = valor;
    }
  } else if (!partial) {
    errors.push("valor e obrigatorio");
  }

  if (Object.hasOwn(input, "status")) {
    const status = parseText(input.status);
    if (!VEHICLE_EXPENSE_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  } else if (!partial) {
    data.status = "pendente";
  }

  if (Object.hasOwn(input, "integrarFinanceiro")) {
    const integrarFinanceiro = parseBoolean(input.integrarFinanceiro);
    if (integrarFinanceiro === null) {
      errors.push("integrarFinanceiro invalido");
    } else {
      data.integrarFinanceiro = integrarFinanceiro;
    }
  } else if (!partial) {
    data.integrarFinanceiro = true;
  }

  if (Object.hasOwn(input, "dataDespesa")) {
    const dataDespesa = parseOptionalText(input.dataDespesa);
    if (!dataDespesa || !isValidDate(dataDespesa)) {
      errors.push("dataDespesa deve estar no formato YYYY-MM-DD");
    } else {
      data.dataDespesa = dataDespesa;
    }
  } else if (!partial) {
    data.dataDespesa = new Date().toISOString().slice(0, 10);
  }

  if (Object.hasOwn(input, "dataVencimento")) {
    const dataVencimento = parseOptionalText(input.dataVencimento);
    if (dataVencimento !== null && !isValidDate(dataVencimento)) {
      errors.push("dataVencimento deve estar no formato YYYY-MM-DD");
    } else {
      data.dataVencimento = dataVencimento;
    }
  } else if (!partial) {
    data.dataVencimento = null;
  }

  if (Object.hasOwn(input, "dataPagamento")) {
    const dataPagamento = parseOptionalText(input.dataPagamento);
    if (dataPagamento !== null && !isValidDate(dataPagamento)) {
      errors.push("dataPagamento deve estar no formato YYYY-MM-DD");
    } else {
      data.dataPagamento = dataPagamento;
    }
  } else if (!partial) {
    data.dataPagamento = null;
  }

  if (Object.hasOwn(input, "observacoes")) {
    const observacoes = parseOptionalText(input.observacoes);
    if (observacoes !== null && observacoes.length > 2000) {
      errors.push("observacoes deve ter no maximo 2000 caracteres");
    } else {
      data.observacoes = observacoes;
    }
  } else if (!partial) {
    data.observacoes = null;
  }

  if (data.dataDespesa && data.dataVencimento && data.dataDespesa > data.dataVencimento) {
    errors.push("dataDespesa nao pode ser maior que dataVencimento");
  }

  if (data.status === "pago" && Object.hasOwn(data, "dataPagamento") && data.dataPagamento === null) {
    errors.push("dataPagamento e obrigatoria para status pago");
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

function validateVehicleExpenseFilters(input) {
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "veiculoId") && input.veiculoId !== "") {
    if (!isValidUuid(input.veiculoId)) {
      errors.push("veiculoId invalido");
    } else {
      data.veiculoId = input.veiculoId;
    }
  }

  if (Object.hasOwn(input, "motoristaId") && input.motoristaId !== "") {
    if (!isValidUuid(input.motoristaId)) {
      errors.push("motoristaId invalido");
    } else {
      data.motoristaId = input.motoristaId;
    }
  }

  if (Object.hasOwn(input, "tipo") && input.tipo !== "") {
    const tipo = parseText(input.tipo);
    if (!VEHICLE_EXPENSE_TYPES.includes(tipo)) {
      errors.push("tipo invalido");
    } else {
      data.tipo = tipo;
    }
  }

  if (Object.hasOwn(input, "status") && input.status !== "") {
    const status = parseText(input.status);
    if (!VEHICLE_EXPENSE_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
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

  if (Object.hasOwn(input, "ativo") && input.ativo !== "") {
    data.ativo = String(input.ativo) !== "false";
  }

  if (data.dataInicio && data.dataFim && data.dataInicio > data.dataFim) {
    errors.push("dataInicio nao pode ser maior que dataFim");
  }

  return { errors, data };
}

module.exports = {
  VEHICLE_EXPENSE_TYPES,
  VEHICLE_EXPENSE_STATUSES,
  validateVehicleExpenseCreate: (input) => validateVehicleExpensePayload(input),
  validateVehicleExpenseUpdate: (input) => validateVehicleExpensePayload(input, { partial: true }),
  validateVehicleExpenseFilters,
};
