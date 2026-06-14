const database = require("../config/database");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

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

async function listByUserId(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "v" });
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
    FROM veiculos v
    WHERE ${tenant.condition}
    ORDER BY placa ASC`,
    tenant.params,
  );

  return result.rows.map(mapVehicle);
}

async function findById(actor, vehicleId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "v" });
  const vehicleIdIndex = tenant.nextIndex;
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
    FROM veiculos v
    WHERE ${tenant.condition} AND id = $${vehicleIdIndex}`,
    [...tenant.params, vehicleId],
  );

  return mapVehicle(result.rows[0]);
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const result = await database.query(
    `INSERT INTO veiculos (
      usuario_id,
      empresa_id,
      placa,
      modelo,
      tipo,
      capacidade,
      ano,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      context.userId,
      context.empresaId,
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

async function updateById(actor, vehicleId, payload) {
  const tenant = buildTenantCondition({ actor, tableAlias: "veiculos", startIndex: 2 });
  const fields = [];
  const values = [vehicleId, ...tenant.params];
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
    WHERE id = $1 AND ${tenant.condition}
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

async function updateStatusById(actor, vehicleId, status) {
  const tenant = buildTenantCondition({ actor, tableAlias: "veiculos", startIndex: 3 });
  const result = await database.query(
    `UPDATE veiculos
    SET status = $2, atualizado_em = NOW()
    WHERE id = $1 AND ${tenant.condition}
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
    [vehicleId, status, ...tenant.params],
  );

  return mapVehicle(result.rows[0]);
}

async function deleteById(actor, vehicleId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "veiculos", startIndex: 2 });
  const result = await database.query(
    `DELETE FROM veiculos
    WHERE id = $1 AND ${tenant.condition}
    RETURNING id`,
    [vehicleId, ...tenant.params],
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
