const database = require("../config/database");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

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

async function listByUserId(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "m" });
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
    FROM motoristas m
    WHERE ${tenant.condition}
    ORDER BY nome ASC`,
    tenant.params,
  );

  return result.rows.map(mapDriver);
}

async function findById(actor, driverId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "m" });
  const driverIdIndex = tenant.nextIndex;
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
    FROM motoristas m
    WHERE ${tenant.condition} AND id = $${driverIdIndex}`,
    [...tenant.params, driverId],
  );

  return mapDriver(result.rows[0]);
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const result = await database.query(
    `INSERT INTO motoristas (
      usuario_id,
      empresa_id,
      nome,
      cpf,
      cnh,
      categoria_cnh,
      validade_cnh,
      telefone,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      context.userId,
      context.empresaId,
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

async function updateById(actor, driverId, payload) {
  const tenant = buildTenantCondition({ actor, tableAlias: "motoristas", startIndex: 2 });
  const fields = [];
  const values = [driverId, ...tenant.params];
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
    WHERE id = $1 AND ${tenant.condition}
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

async function updateStatusById(actor, driverId, status) {
  const tenant = buildTenantCondition({ actor, tableAlias: "motoristas", startIndex: 3 });
  const result = await database.query(
    `UPDATE motoristas
    SET status = $2, atualizado_em = NOW()
    WHERE id = $1 AND ${tenant.condition}
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
    [driverId, status, ...tenant.params],
  );

  return mapDriver(result.rows[0]);
}

async function deleteById(actor, driverId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "motoristas", startIndex: 2 });
  const result = await database.query(
    `DELETE FROM motoristas
    WHERE id = $1 AND ${tenant.condition}
    RETURNING id`,
    [driverId, ...tenant.params],
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
