const { isValidCnpj, formatCnpj, onlyDigits } = require("../utils/cnpj");

const COMPANY_STATUSES = ["ativo", "inativo"];

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCompanyPayload(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  const razaoSocial = parseText(input.razaoSocial || input.razao_social);
  if (Object.hasOwn(input, "razaoSocial") || Object.hasOwn(input, "razao_social")) {
    if (razaoSocial.length < 3 || razaoSocial.length > 150) {
      errors.push("razaoSocial deve ter entre 3 e 150 caracteres");
    } else {
      data.razaoSocial = razaoSocial;
    }
  } else if (!partial) {
    errors.push("razaoSocial e obrigatoria");
  }

  const nomeFantasia = parseText(input.nomeFantasia || input.nome_fantasia);
  if (Object.hasOwn(input, "nomeFantasia") || Object.hasOwn(input, "nome_fantasia")) {
    if (nomeFantasia.length < 3 || nomeFantasia.length > 150) {
      errors.push("nomeFantasia deve ter entre 3 e 150 caracteres");
    } else {
      data.nomeFantasia = nomeFantasia;
    }
  } else if (!partial) {
    errors.push("nomeFantasia e obrigatorio");
  }

  if (Object.hasOwn(input, "cnpj")) {
    if (!isValidCnpj(input.cnpj)) {
      errors.push("cnpj invalido");
    } else {
      data.cnpj = formatCnpj(input.cnpj);
    }
  } else if (!partial) {
    errors.push("cnpj e obrigatorio");
  }

  const email = parseText(input.email).toLowerCase();
  if (Object.hasOwn(input, "email")) {
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("email invalido");
    } else {
      data.email = email;
    }
  } else if (!partial) {
    errors.push("email e obrigatorio");
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

  const endereco = parseText(input.endereco);
  if (Object.hasOwn(input, "endereco")) {
    if (endereco.length < 5 || endereco.length > 255) {
      errors.push("endereco deve ter entre 5 e 255 caracteres");
    } else {
      data.endereco = endereco;
    }
  } else if (!partial) {
    errors.push("endereco e obrigatorio");
  }

  const cidade = parseText(input.cidade);
  if (Object.hasOwn(input, "cidade")) {
    if (cidade.length < 2 || cidade.length > 120) {
      errors.push("cidade deve ter entre 2 e 120 caracteres");
    } else {
      data.cidade = cidade;
    }
  } else if (!partial) {
    errors.push("cidade e obrigatoria");
  }

  const estado = parseText(input.estado).toUpperCase();
  if (Object.hasOwn(input, "estado")) {
    if (!/^[A-Z]{2}$/.test(estado)) {
      errors.push("estado deve conter 2 letras");
    } else {
      data.estado = estado;
    }
  } else if (!partial) {
    errors.push("estado e obrigatorio");
  }

  const cep = onlyDigits(input.cep);
  if (Object.hasOwn(input, "cep")) {
    if (!/^\d{8}$/.test(cep)) {
      errors.push("cep deve conter 8 digitos");
    } else {
      data.cep = cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    }
  } else if (!partial) {
    errors.push("cep e obrigatorio");
  }

  const logoUrl = parseText(input.logoUrl || input.logo_url);
  if (Object.hasOwn(input, "logoUrl") || Object.hasOwn(input, "logo_url")) {
    if (logoUrl && logoUrl.length > 500) {
      errors.push("logoUrl deve ter no maximo 500 caracteres");
    } else {
      data.logoUrl = logoUrl || null;
    }
  } else if (!partial) {
    data.logoUrl = null;
  }

  const status = parseText(input.status);
  if (Object.hasOwn(input, "status")) {
    if (!COMPANY_STATUSES.includes(status)) {
      errors.push("status invalido");
    } else {
      data.status = status;
    }
  } else if (!partial) {
    data.status = "ativo";
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

module.exports = {
  COMPANY_STATUSES,
  isValidUuid,
  validateCompanyCreate: (input) => validateCompanyPayload(input),
  validateCompanyUpdate: (input) => validateCompanyPayload(input, { partial: true }),
};
