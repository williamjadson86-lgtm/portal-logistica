const { isValidUuid } = require("./financialValidation");

const VEHICLE_MAINTENANCE_STATUSES = ["agendada", "em_execucao", "concluida", "cancelada"];

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

function validateVehicleMaintenancePayload(input, options = {}) {
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

  if (Object.hasOwn(input, "tipo")) {
    const tipo = parseText(input.tipo);
    if (tipo.length < 3 || tipo.length > 40) {
      errors.push("tipo deve ter entre 3 e 40 caracteres");
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

  if (Object.hasOwn(input, "custo")) {
    const custo = parseAmount(input.custo);
    if (!Number.isFinite(custo) || custo < 0) {
      errors.push("custo deve ser igual ou maior que zero");
    } else {
      data.custo = custo;
    }
  } else if (!partial) {
    errors.push("custo e obrigatorio");
  }

  if (Object.hasOwn(input, "dataManutencao")) {
    const dataManutencao = parseOptionalText(input.dataManutencao);
    if (!dataManutencao || !isValidDate(dataManutencao)) {
      errors.push("dataManutencao deve estar no formato YYYY-MM-DD");
    } else {
      data.dataManutencao = dataManutencao;
    }
  } else if (!partial) {
    data.dataManutencao = new Date().toISOString().slice(0, 10);
  }

  if (Object.hasOwn(input, "proximaManutencao")) {
    const proximaManutencao = parseOptionalText(input.proximaManutencao);
    if (proximaManutencao !== null && !isValidDate(proximaManutencao)) {
      errors.push("proximaManutencao deve estar no formato YYYY-MM-DD");
    } else {
      data.proximaManutencao = proximaManutencao;
    }
  } else if (!partial) {
    data.proximaManutencao = null;
  }

  if (Object.hasOwn(input, "status")) {
    const status = parseText(input.status);
    if (!VEHICLE_MAINTENANCE_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  } else if (!partial) {
    data.status = "agendada";
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

  if (
    data.dataManutencao &&
    data.proximaManutencao &&
    data.dataManutencao > data.proximaManutencao
  ) {
    errors.push("proximaManutencao deve ser igual ou posterior a dataManutencao");
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

function validateVehicleMaintenanceFilters(input) {
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "veiculoId") && input.veiculoId !== "") {
    if (!isValidUuid(input.veiculoId)) {
      errors.push("veiculoId invalido");
    } else {
      data.veiculoId = input.veiculoId;
    }
  }

  if (Object.hasOwn(input, "status") && input.status !== "") {
    const status = parseText(input.status);
    if (!VEHICLE_MAINTENANCE_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  }

  if (Object.hasOwn(input, "tipo") && input.tipo !== "") {
    const tipo = parseText(input.tipo);
    if (tipo.length < 3 || tipo.length > 40) {
      errors.push("tipo invalido");
    } else {
      data.tipo = tipo;
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
  VEHICLE_MAINTENANCE_STATUSES,
  validateVehicleMaintenanceCreate: (input) => validateVehicleMaintenancePayload(input),
  validateVehicleMaintenanceUpdate: (input) =>
    validateVehicleMaintenancePayload(input, { partial: true }),
  validateVehicleMaintenanceFilters,
};
