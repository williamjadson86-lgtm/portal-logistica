const ROUTE_STATUSES = ["planejada", "em_andamento", "concluida", "cancelada"];

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateRoutePayload(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  const code = parseText(input.codigo).toUpperCase();
  if (Object.hasOwn(input, "codigo")) {
    if (code.length < 3 || code.length > 40) {
      errors.push("codigo deve ter entre 3 e 40 caracteres");
    } else {
      data.codigo = code;
    }
  } else if (!partial) {
    errors.push("codigo e obrigatorio");
  }

  if (Object.hasOwn(input, "motoristaId")) {
    if (!isValidUuid(input.motoristaId)) {
      errors.push("motoristaId invalido");
    } else {
      data.motoristaId = input.motoristaId;
    }
  } else if (!partial) {
    errors.push("motoristaId e obrigatorio");
  }

  if (Object.hasOwn(input, "veiculoId")) {
    if (!isValidUuid(input.veiculoId)) {
      errors.push("veiculoId invalido");
    } else {
      data.veiculoId = input.veiculoId;
    }
  } else if (!partial) {
    errors.push("veiculoId e obrigatorio");
  }

  const origem = parseText(input.origem);
  if (Object.hasOwn(input, "origem")) {
    if (origem.length < 5 || origem.length > 150) {
      errors.push("origem deve ter entre 5 e 150 caracteres");
    } else {
      data.origem = origem;
    }
  } else if (!partial) {
    errors.push("origem e obrigatoria");
  }

  const destino = parseText(input.destino);
  if (Object.hasOwn(input, "destino")) {
    if (destino.length < 5 || destino.length > 150) {
      errors.push("destino deve ter entre 5 e 150 caracteres");
    } else {
      data.destino = destino;
    }
  } else if (!partial) {
    errors.push("destino e obrigatoria");
  }

  const dataRota = parseText(input.dataRota);
  if (Object.hasOwn(input, "dataRota")) {
    if (!isValidDate(dataRota)) {
      errors.push("dataRota deve estar no formato YYYY-MM-DD");
    } else {
      data.dataRota = dataRota;
    }
  } else if (!partial) {
    errors.push("dataRota e obrigatoria");
  }

  if (Object.hasOwn(input, "observacoes")) {
    const observacoes = parseText(input.observacoes);
    if (observacoes.length > 2000) {
      errors.push("observacoes deve ter no maximo 2000 caracteres");
    } else {
      data.observacoes = observacoes || null;
    }
  } else if (!partial) {
    data.observacoes = null;
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

function validateRouteDeliveries(input) {
  const entregaIds = Array.isArray(input.entregaIds) ? input.entregaIds : [];
  const normalized = [...new Set(entregaIds)];

  if (normalized.length === 0) {
    return { errors: ["informe ao menos uma entrega"], data: {} };
  }

  if (!normalized.every(isValidUuid)) {
    return { errors: ["entregaIds invalidos"], data: {} };
  }

  return { errors: [], data: { entregaIds: normalized } };
}

module.exports = {
  ROUTE_STATUSES,
  isValidUuid,
  validateRouteCreate: (input) => validateRoutePayload(input),
  validateRouteUpdate: (input) => validateRoutePayload(input, { partial: true }),
  validateRouteDeliveries,
};
