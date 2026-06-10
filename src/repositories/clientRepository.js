const database = require("../config/database");

function formatDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  return value || "";
}

function mapClient(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nome: row.nome,
    documento: formatDocument(row.documento),
    email: row.email,
    telefone: row.telefone,
    contatoNome: row.contatoNome,
    cidade: row.cidade,
    estado: row.estado,
    endereco: row.endereco,
    status: row.status,
    observacoes: row.observacoes || "",
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM clientes
    WHERE usuario_id = $1
    ORDER BY nome ASC`,
    [userId],
  );

  return result.rows.map(mapClient);
}

async function findById(userId, clientId) {
  const result = await database.query(
    `SELECT
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM clientes
    WHERE usuario_id = $1 AND id = $2`,
    [userId, clientId],
  );

  return mapClient(result.rows[0]);
}

async function create(userId, payload) {
  const result = await database.query(
    `INSERT INTO clientes (
      usuario_id,
      nome,
      documento,
      email,
      telefone,
      contato_nome,
      cidade,
      estado,
      endereco,
      status,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      userId,
      payload.nome,
      payload.documento,
      payload.email,
      payload.telefone,
      payload.contatoNome,
      payload.cidade,
      payload.estado,
      payload.endereco,
      payload.status,
      payload.observacoes,
    ],
  );

  return mapClient(result.rows[0]);
}

async function updateById(userId, clientId, payload) {
  const fields = [];
  const values = [userId, clientId];
  const mapping = {
    nome: "nome",
    documento: "documento",
    email: "email",
    telefone: "telefone",
    contatoNome: "contato_nome",
    cidade: "cidade",
    estado: "estado",
    endereco: "endereco",
    status: "status",
    observacoes: "observacoes",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);
  }

  fields.push("atualizado_em = NOW()");

  const result = await database.query(
    `UPDATE clientes
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    values,
  );

  return mapClient(result.rows[0]);
}

async function updateStatusById(userId, clientId, status) {
  const result = await database.query(
    `UPDATE clientes
    SET status = $3, atualizado_em = NOW()
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [userId, clientId, status],
  );

  return mapClient(result.rows[0]);
}

async function deleteById(userId, clientId) {
  const result = await database.query(
    `DELETE FROM clientes
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    [userId, clientId],
  );

  return result.rows[0] || null;
}

module.exports = {
  listByUserId,
  findById,
  create,
  updateById,
  updateStatusById,
  deleteById,
};
