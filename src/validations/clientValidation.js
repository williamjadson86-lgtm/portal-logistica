const CLIENT_STATUSES = ["ativo", "inativo", "bloqueado"];

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDocument(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateClientPayload(input, options = {}) {
  const { partial = false } = options;
  const errors = [];
  const data = {};

  const nome = parseText(input.nome);
  if (Object.hasOwn(input, "nome")) {
    if (nome.length < 3 || nome.length > 150) {
      errors.push("nome deve ter entre 3 e 150 caracteres");
    } else {
      data.nome = nome;
    }
  } else if (!partial) {
    errors.push("nome e obrigatorio");
  }

  if (Object.hasOwn(input, "documento")) {
    const documento = normalizeDocument(input.documento);
    if (documento.length !== 11 && documento.length !== 14) {
      errors.push("documento deve conter 11 ou 14 digitos");
    } else {
      data.documento = documento;
    }
  } else if (!partial) {
    errors.push("documento e obrigatorio");
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

  const contatoNome = parseText(input.contatoNome);
  if (Object.hasOwn(input, "contatoNome")) {
    if (contatoNome.length < 3 || contatoNome.length > 150) {
      errors.push("contatoNome deve ter entre 3 e 150 caracteres");
    } else {
      data.contatoNome = contatoNome;
    }
  } else if (!partial) {
    errors.push("contatoNome e obrigatorio");
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

  const observacoes = parseText(input.observacoes);
  if (Object.hasOwn(input, "observacoes")) {
    if (observacoes.length > 2000) {
      errors.push("observacoes deve ter no maximo 2000 caracteres");
    } else {
      data.observacoes = observacoes;
    }
  } else if (!partial) {
    data.observacoes = "";
  }

  const status = parseText(input.status);
  if (Object.hasOwn(input, "status")) {
    if (!CLIENT_STATUSES.includes(status)) {
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

function validateClientStatus(input) {
  const status = parseText(input.status);
  const errors = CLIENT_STATUSES.includes(status) ? [] : ["status invalido"];
  return { errors, data: errors.length ? {} : { status } };
}

module.exports = {
  CLIENT_STATUSES,
  isValidUuid,
  validateClientCreate: (input) => validateClientPayload(input),
  validateClientUpdate: (input) => validateClientPayload(input, { partial: true }),
  validateClientStatus,
};
