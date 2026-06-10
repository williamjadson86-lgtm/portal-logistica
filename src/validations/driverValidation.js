const { isValidCpf } = require("./userValidation");

const DRIVER_STATUSES = ["ativo", "inativo", "afastado"];
const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

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

function validateDriverPayload(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  const name = parseText(input.nome);
  if (Object.hasOwn(input, "nome")) {
    if (name.length < 3 || name.length > 150) {
      errors.push("nome deve ter entre 3 e 150 caracteres");
    } else {
      data.nome = name;
    }
  } else if (!partial) {
    errors.push("nome e obrigatorio");
  }

  if (Object.hasOwn(input, "cpf")) {
    if (!isValidCpf(input.cpf)) {
      errors.push("cpf invalido");
    } else {
      data.cpf = String(input.cpf).replace(/\D/g, "").replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4",
      );
    }
  } else if (!partial) {
    errors.push("cpf e obrigatorio");
  }

  const cnh = parseText(input.cnh).toUpperCase();
  if (Object.hasOwn(input, "cnh")) {
    if (cnh.length < 5 || cnh.length > 30) {
      errors.push("cnh deve ter entre 5 e 30 caracteres");
    } else {
      data.cnh = cnh;
    }
  } else if (!partial) {
    errors.push("cnh e obrigatoria");
  }

  const categoriaCnh = parseText(input.categoriaCnh).toUpperCase();
  if (Object.hasOwn(input, "categoriaCnh")) {
    if (!CNH_CATEGORIES.includes(categoriaCnh)) {
      errors.push("categoriaCnh invalida");
    } else {
      data.categoriaCnh = categoriaCnh;
    }
  } else if (!partial) {
    errors.push("categoriaCnh e obrigatoria");
  }

  const validadeCnh = parseText(input.validadeCnh);
  if (Object.hasOwn(input, "validadeCnh")) {
    if (!isValidDate(validadeCnh)) {
      errors.push("validadeCnh deve estar no formato YYYY-MM-DD");
    } else {
      data.validadeCnh = validadeCnh;
    }
  } else if (!partial) {
    errors.push("validadeCnh e obrigatoria");
  }

  const telefone = parseText(input.telefone);
  if (Object.hasOwn(input, "telefone")) {
    if (telefone.length < 10 || telefone.length > 20) {
      errors.push("telefone deve ter entre 10 e 20 caracteres");
    } else {
      data.telefone = telefone;
    }
  } else if (!partial) {
    errors.push("telefone e obrigatorio");
  }

  const status = parseText(input.status);
  if (Object.hasOwn(input, "status")) {
    if (!DRIVER_STATUSES.includes(status)) {
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

function validateDriverStatus(input) {
  const status = parseText(input.status);
  const errors = DRIVER_STATUSES.includes(status) ? [] : ["status invalido"];
  return { errors, data: errors.length ? {} : { status } };
}

module.exports = {
  DRIVER_STATUSES,
  CNH_CATEGORIES,
  isValidUuid,
  validateDriverCreate: (input) => validateDriverPayload(input),
  validateDriverUpdate: (input) => validateDriverPayload(input, { partial: true }),
  validateDriverStatus,
};
