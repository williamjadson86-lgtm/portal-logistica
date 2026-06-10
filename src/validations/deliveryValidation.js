const DELIVERY_STATUSES = [
  "pendente",
  "coletada",
  "em_transito",
  "em_rota",
  "entregue",
  "cancelada",
];

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

function normalizeState(value) {
  return parseText(value).toUpperCase();
}

function normalizeCode(value) {
  return parseText(value).toUpperCase();
}

function parseAmount(value) {
  if (value == null || value === "") {
    return null;
  }

  const normalized =
    typeof value === "number" ? String(value) : String(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
}

function validateCoreFields(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  const fieldRules = [
    {
      key: "codigo",
      required: true,
      parse: normalizeCode,
      validate: (value) => value.length >= 3 && value.length <= 30,
      message: "codigo deve ter entre 3 e 30 caracteres",
    },
    {
      key: "cliente",
      required: true,
      parse: parseText,
      validate: (value) => value.length >= 3 && value.length <= 160,
      message: "cliente deve ter entre 3 e 160 caracteres",
    },
    {
      key: "origem",
      required: true,
      parse: parseText,
      validate: (value) => value.length >= 5 && value.length <= 255,
      message: "origem deve ter entre 5 e 255 caracteres",
    },
    {
      key: "destino",
      required: true,
      parse: parseText,
      validate: (value) => value.length >= 5 && value.length <= 255,
      message: "destino deve ter entre 5 e 255 caracteres",
    },
    {
      key: "cidade",
      required: true,
      parse: parseText,
      validate: (value) => value.length >= 2 && value.length <= 120,
      message: "cidade deve ter entre 2 e 120 caracteres",
    },
    {
      key: "estado",
      required: true,
      parse: normalizeState,
      validate: (value) => /^[A-Z]{2}$/.test(value),
      message: "estado deve conter 2 letras",
    },
    {
      key: "status",
      required: true,
      parse: parseText,
      validate: (value) => DELIVERY_STATUSES.includes(value),
      message: "status invalido",
    },
    {
      key: "dataPrevista",
      required: true,
      parse: parseText,
      validate: isValidDate,
      message: "dataPrevista deve estar no formato YYYY-MM-DD",
    },
    {
      key: "observacoes",
      required: false,
      parse: parseOptionalText,
      validate: (value) => value === null || value.length <= 2000,
      message: "observacoes deve ter no maximo 2000 caracteres",
    },
    {
      key: "valorFrete",
      required: false,
      parse: parseAmount,
      validate: (value) => value === null || (Number.isFinite(value) && value > 0),
      message: "valorFrete deve ser maior que zero",
    },
  ];

  for (const rule of fieldRules) {
    const hasValue = Object.hasOwn(input, rule.key);

    if (!hasValue) {
      if (!partial && rule.required) {
        errors.push(`${rule.key} e obrigatorio`);
      }
      continue;
    }

    const parsed = rule.parse(input[rule.key]);

    if (!rule.validate(parsed)) {
      errors.push(rule.message);
      continue;
    }

    data[rule.key] = parsed;
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

function validateDeliveryCreate(input) {
  return validateCoreFields(input);
}

function validateDeliveryUpdate(input) {
  return validateCoreFields(input, { partial: true });
}

function validateDeliveryStatusUpdate(input) {
  const errors = [];
  const status = parseText(input.status);

  if (!DELIVERY_STATUSES.includes(status)) {
    errors.push("status invalido");
  }

  return {
    errors,
    data: errors.length ? {} : { status },
  };
}

module.exports = {
  DELIVERY_STATUSES,
  isValidUuid,
  validateDeliveryCreate,
  validateDeliveryUpdate,
  validateDeliveryStatusUpdate,
};
