const database = require("../config/database");
const HttpError = require("../errors/HttpError");
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

async function ensureDeliveryAccess(actor, entregaId, client = database) {
  const tenant = buildTenantCondition({ actor, tableAlias: "d" });
  const deliveryIdIndex = tenant.nextIndex;
  const result = await client.query(
    `SELECT id
    FROM entregas d
    WHERE ${tenant.condition}
      AND d.id = $${deliveryIdIndex}`,
    [...tenant.params, entregaId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Entrega nao encontrada para registrar evento");
  }
}

function resolveAppendEventArgs(actorOrEvent, maybeEvent, maybeClient) {
  if (maybeEvent) {
    return {
      actor: actorOrEvent,
      event: maybeEvent,
      client: maybeClient || database,
    };
  }

  return {
    actor: actorOrEvent?.actor || {
      id: actorOrEvent?.usuarioId || null,
      empresaId: actorOrEvent?.empresaId || null,
      tipoUsuario: actorOrEvent?.tipoUsuario || actorOrEvent?.perfil || actorOrEvent?.role || null,
    },
    event: actorOrEvent,
    client: maybeEvent || database,
  };
}

async function appendEvent(actorOrEvent, maybeEvent, maybeClient = database) {
  const { actor, event, client } = resolveAppendEventArgs(
    actorOrEvent,
    maybeEvent,
    maybeClient,
  );
  const context = normalizeActor(actor);
  await ensureDeliveryAccess(context, event.entregaId, client);
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
      event.usuarioId || context.userId || null,
      context.empresaId || event.empresaId || null,
      event.tipoEvento,
      event.descricao,
      event.dados ? JSON.stringify(event.dados) : null,
    ],
  );

  return mapEvent(result.rows[0]);
}

async function appendMany(actorOrEvents, maybeEvents, maybeClient = database) {
  const actor = Array.isArray(actorOrEvents) ? null : actorOrEvents;
  const events = Array.isArray(actorOrEvents) ? actorOrEvents : maybeEvents;
  const client = Array.isArray(actorOrEvents) ? maybeEvents || database : maybeClient;
  const created = [];

  for (const event of events) {
    created.push(await appendEvent(actor || event.actor || event, event, client));
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
