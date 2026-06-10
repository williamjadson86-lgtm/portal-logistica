const PROOF_TYPES = ["foto", "pdf", "assinatura", "observacao"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateProofCreate(input, file) {
  const errors = [];
  const data = {};
  const tipo = parseText(input.tipo);
  const observacao = parseText(input.observacao);

  if (!PROOF_TYPES.includes(tipo)) {
    errors.push("tipo invalido");
  } else {
    data.tipo = tipo;
  }

  if (observacao.length > 2000) {
    errors.push("observacao deve ter no maximo 2000 caracteres");
  } else {
    data.observacao = observacao || null;
  }

  if (tipo === "observacao") {
    if (!observacao) {
      errors.push("observacao e obrigatoria para comprovante do tipo observacao");
    }
  } else if (!file) {
    errors.push("arquivo e obrigatorio para este tipo de comprovante");
  }

  return { errors, data };
}

function validateProofUpdate(input) {
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "tipo")) {
    const tipo = parseText(input.tipo);
    if (!PROOF_TYPES.includes(tipo)) {
      errors.push("tipo invalido");
    } else {
      data.tipo = tipo;
    }
  }

  if (Object.hasOwn(input, "observacao")) {
    const observacao = parseText(input.observacao);
    if (observacao.length > 2000) {
      errors.push("observacao deve ter no maximo 2000 caracteres");
    } else {
      data.observacao = observacao || null;
    }
  }

  if (Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo para atualizar");
  }

  return { errors, data };
}

module.exports = {
  PROOF_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  isValidUuid,
  validateProofCreate,
  validateProofUpdate,
};
