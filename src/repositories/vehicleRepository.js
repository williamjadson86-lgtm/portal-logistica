const database = require("../config/database");

function mapVehicle(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    placa: row.placa,
    modelo: row.modelo,
    tipo: row.tipo,
    capacidade: row.capacidade,
    ano: row.ano,
    status: row.status,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM veiculos
    WHERE usuario_id = $1
    ORDER BY placa ASC`,
    [userId],
  );

  return result.rows.map(mapVehicle);
}

async function findById(userId, vehicleId) {
  const result = await database.query(
    `SELECT
      id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM veiculos
    WHERE usuario_id = $1 AND id = $2`,
    [userId, vehicleId],
  );

  return mapVehicle(result.rows[0]);
}

async function create(userId, payload) {
  const result = await database.query(
    `INSERT INTO veiculos (
      usuario_id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      userId,
      payload.placa,
      payload.modelo,
      payload.tipo,
      payload.capacidade,
      payload.ano,
      payload.status,
    ],
  );

  return mapVehicle(result.rows[0]);
}

async function updateById(userId, vehicleId, payload) {
  const fields = [];
  const values = [userId, vehicleId];
  const mapping = {
    placa: "placa",
    modelo: "modelo",
    tipo: "tipo",
    capacidade: "capacidade",
    ano: "ano",
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
    `UPDATE veiculos
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    values,
  );

  return mapVehicle(result.rows[0]);
}

async function updateStatusById(userId, vehicleId, status) {
  const result = await database.query(
    `UPDATE veiculos
    SET status = $3, atualizado_em = NOW()
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [userId, vehicleId, status],
  );

  return mapVehicle(result.rows[0]);
}

async function deleteById(userId, vehicleId) {
  const result = await database.query(
    `DELETE FROM veiculos
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    [userId, vehicleId],
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
