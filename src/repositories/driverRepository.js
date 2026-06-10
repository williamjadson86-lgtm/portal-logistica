const database = require("../config/database");

function mapDriver(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    cnh: row.cnh,
    categoriaCnh: row.categoriaCnh,
    validadeCnh: row.validadeCnh,
    telefone: row.telefone,
    status: row.status,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      id,
      nome,
      cpf,
      cnh,
      categoria_cnh AS "categoriaCnh",
      TO_CHAR(validade_cnh, 'YYYY-MM-DD') AS "validadeCnh",
      telefone,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM motoristas
    WHERE usuario_id = $1
    ORDER BY nome ASC`,
    [userId],
  );

  return result.rows.map(mapDriver);
}

async function findById(userId, driverId) {
  const result = await database.query(
    `SELECT
      id,
      nome,
      cpf,
      cnh,
      categoria_cnh AS "categoriaCnh",
      TO_CHAR(validade_cnh, 'YYYY-MM-DD') AS "validadeCnh",
      telefone,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM motoristas
    WHERE usuario_id = $1 AND id = $2`,
    [userId, driverId],
  );

  return mapDriver(result.rows[0]);
}

async function create(userId, payload) {
  const result = await database.query(
    `INSERT INTO motoristas (
      usuario_id,
      nome,
      cpf,
      cnh,
      categoria_cnh,
      validade_cnh,
      telefone,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      nome,
      cpf,
      cnh,
      categoria_cnh AS "categoriaCnh",
      TO_CHAR(validade_cnh, 'YYYY-MM-DD') AS "validadeCnh",
      telefone,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      userId,
      payload.nome,
      payload.cpf,
      payload.cnh,
      payload.categoriaCnh,
      payload.validadeCnh,
      payload.telefone,
      payload.status,
    ],
  );

  return mapDriver(result.rows[0]);
}

async function updateById(userId, driverId, payload) {
  const fields = [];
  const values = [userId, driverId];
  const mapping = {
    nome: "nome",
    cpf: "cpf",
    cnh: "cnh",
    categoriaCnh: "categoria_cnh",
    validadeCnh: "validade_cnh",
    telefone: "telefone",
    status: "status",
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
    `UPDATE motoristas
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      nome,
      cpf,
      cnh,
      categoria_cnh AS "categoriaCnh",
      TO_CHAR(validade_cnh, 'YYYY-MM-DD') AS "validadeCnh",
      telefone,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    values,
  );

  return mapDriver(result.rows[0]);
}

async function updateStatusById(userId, driverId, status) {
  const result = await database.query(
    `UPDATE motoristas
    SET status = $3, atualizado_em = NOW()
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      nome,
      cpf,
      cnh,
      categoria_cnh AS "categoriaCnh",
      TO_CHAR(validade_cnh, 'YYYY-MM-DD') AS "validadeCnh",
      telefone,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [userId, driverId, status],
  );

  return mapDriver(result.rows[0]);
}

async function deleteById(userId, driverId) {
  const result = await database.query(
    `DELETE FROM motoristas
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    [userId, driverId],
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
