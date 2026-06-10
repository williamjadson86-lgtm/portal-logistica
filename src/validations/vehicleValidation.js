const VEHICLE_STATUSES = ["disponivel", "em_rota", "manutencao", "inativo"];

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateVehiclePayload(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  const placa = parseText(input.placa).toUpperCase();
  if (Object.hasOwn(input, "placa")) {
    if (!/^[A-Z0-9-]{7,8}$/.test(placa)) {
      errors.push("placa invalida");
    } else {
      data.placa = placa;
    }
  } else if (!partial) {
    errors.push("placa e obrigatoria");
  }

  const modelo = parseText(input.modelo);
  if (Object.hasOwn(input, "modelo")) {
    if (modelo.length < 2 || modelo.length > 120) {
      errors.push("modelo deve ter entre 2 e 120 caracteres");
    } else {
      data.modelo = modelo;
    }
  } else if (!partial) {
    errors.push("modelo e obrigatorio");
  }

  const tipo = parseText(input.tipo);
  if (Object.hasOwn(input, "tipo")) {
    if (tipo.length < 2 || tipo.length > 80) {
      errors.push("tipo deve ter entre 2 e 80 caracteres");
    } else {
      data.tipo = tipo;
    }
  } else if (!partial) {
    errors.push("tipo e obrigatorio");
  }

  if (Object.hasOwn(input, "capacidade")) {
    const capacidade = Number(input.capacidade);
    if (!Number.isFinite(capacidade) || capacidade <= 0) {
      errors.push("capacidade deve ser um numero maior que zero");
    } else {
      data.capacidade = capacidade;
    }
  } else if (!partial) {
    errors.push("capacidade e obrigatoria");
  }

  if (Object.hasOwn(input, "ano")) {
    const ano = Number(input.ano);
    if (!Number.isInteger(ano) || ano < 1980 || ano > 2100) {
      errors.push("ano deve estar entre 1980 e 2100");
    } else {
      data.ano = ano;
    }
  } else if (!partial) {
    errors.push("ano e obrigatorio");
  }

  const status = parseText(input.status);
  if (Object.hasOwn(input, "status")) {
    if (!VEHICLE_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  } else if (!partial) {
    errors.push("status e obrigatorio");
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

function validateVehicleStatus(input) {
  const status = parseText(input.status);
  const errors = VEHICLE_STATUSES.includes(status) ? [] : ["status invalido"];
  return { errors, data: errors.length ? {} : { status } };
}

module.exports = {
  VEHICLE_STATUSES,
  isValidUuid,
  validateVehicleCreate: (input) => validateVehiclePayload(input),
  validateVehicleUpdate: (input) => validateVehiclePayload(input, { partial: true }),
  validateVehicleStatus,
};
