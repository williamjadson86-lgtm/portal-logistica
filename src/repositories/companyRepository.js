const database = require("../config/database");

function buildDefaultCompanyPayload(userLike) {
  return {
    nome:
      userLike?.nome && String(userLike.nome).trim()
        ? `Empresa de ${String(userLike.nome).trim()}`
        : "Empresa Principal",
    documento: userLike?.cpf || null,
    email: userLike?.email || null,
    telefone: userLike?.telefone || null,
  };
}

async function createDefaultCompany(userLike, client = database) {
  const payload = buildDefaultCompanyPayload(userLike);
  const result = await client.query(
    `INSERT INTO empresas (nome, documento, email, telefone, ativo)
    VALUES ($1, $2, $3, $4, TRUE)
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      ativo,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [payload.nome, payload.documento, payload.email, payload.telefone],
  );

  return result.rows[0];
}

module.exports = {
  buildDefaultCompanyPayload,
  createDefaultCompany,
};
