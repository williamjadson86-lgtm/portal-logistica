const database = require("../config/database");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

function mapEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    entregaId: row.entregaId,
    usuarioId: row.usuarioId,
    usuarioNome: row.usuarioNome || null,
    tipoEvento: row.tipoEvento,
    descricao: row.descricao,
    dados: row.dados || null,
    criadoEm: row.criadoEm,
  };
}

async function appendEvent(event, client = database) {
  const result = await client.query(
    `INSERT INTO entrega_eventos (
      entrega_id,
      usuario_id,
      empresa_id,
      tipo_evento,
      descricao,
      dados
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      entrega_id AS "entregaId",
      usuario_id AS "usuarioId",
      tipo_evento AS "tipoEvento",
      descricao,
      dados,
      criado_em AS "criadoEm"`,
    [
      event.entregaId,
      event.usuarioId || null,
      event.empresaId || null,
      event.tipoEvento,
      event.descricao,
      event.dados ? JSON.stringify(event.dados) : null,
    ],
  );

  return mapEvent(result.rows[0]);
}

async function appendMany(events, client = database) {
  const created = [];

  for (const event of events) {
    created.push(await appendEvent(event, client));
  }

  return created;
}

async function listByDeliveryId(actor, entregaId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "e" });
  const entregaIdIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT
      ee.id,
      ee.entrega_id AS "entregaId",
      ee.usuario_id AS "usuarioId",
      u.nome AS "usuarioNome",
      ee.tipo_evento AS "tipoEvento",
      ee.descricao,
      ee.dados,
      ee.criado_em AS "criadoEm"
    FROM entrega_eventos ee
    INNER JOIN entregas e ON e.id = ee.entrega_id
    LEFT JOIN usuarios u ON u.id = ee.usuario_id
    WHERE ${tenant.condition}
      AND ee.entrega_id = $${entregaIdIndex}
    ORDER BY ee.criado_em DESC, ee.id DESC`,
    [...tenant.params, entregaId],
  );

  return result.rows.map(mapEvent);
}

module.exports = {
  appendEvent,
  appendMany,
  listByDeliveryId,
};
