const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const { USER_ROLES } = require("../config/permissions");
const { findLinkedDriverId } = require("./driverAccessRepository");

function mapProof(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    entregaId: row.entregaId,
    usuarioId: row.usuarioId,
    enviadoPor: row.enviadoPor,
    codigoEntrega: row.codigoEntrega,
    cliente: row.cliente,
    tipo: row.tipo,
    arquivoNome: row.arquivoNome,
    arquivoCaminho: row.arquivoCaminho,
    mimeType: row.mimeType,
    tamanhoBytes: row.tamanhoBytes,
    observacao: row.observacao || "",
    ativo: row.ativo,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function listByUserId(userId, filters = {}) {
  const values = [userId];
  const conditions = ["c.usuario_id = $1"];

  if (filters.entregaId) {
    values.push(filters.entregaId);
    conditions.push(`c.entrega_id = $${values.length}`);
  }

  if (typeof filters.ativo === "boolean") {
    values.push(filters.ativo);
    conditions.push(`c.ativo = $${values.length}`);
  }

  const result = await database.query(
    `SELECT
      c.id,
      c.entrega_id AS "entregaId",
      c.usuario_id AS "usuarioId",
      u.nome AS "enviadoPor",
      e.codigo AS "codigoEntrega",
      e.cliente,
      c.tipo,
      c.arquivo_nome AS "arquivoNome",
      c.arquivo_caminho AS "arquivoCaminho",
      c.mime_type AS "mimeType",
      c.tamanho_bytes AS "tamanhoBytes",
      c.observacao,
      c.ativo,
      c.criado_em AS "criadoEm",
      c.atualizado_em AS "atualizadoEm"
    FROM comprovantes c
    INNER JOIN entregas e ON e.id = c.entrega_id
    INNER JOIN usuarios u ON u.id = c.usuario_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY c.criado_em DESC`,
    values,
  );

  return result.rows.map(mapProof);
}

async function listForUser(user, filters = {}) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return listByUserId(user.id, filters);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return [];
  }

  const values = [user.id, driverId];
  const conditions = [
    "e.usuario_id = $1",
    `EXISTS (
      SELECT 1
      FROM rota_entregas re
      INNER JOIN rotas_operacionais r ON r.id = re.rota_id
      WHERE re.entrega_id = e.id
        AND r.motorista_id = $2
    )`,
  ];

  if (filters.entregaId) {
    values.push(filters.entregaId);
    conditions.push(`c.entrega_id = $${values.length}`);
  }

  if (typeof filters.ativo === "boolean") {
    values.push(filters.ativo);
    conditions.push(`c.ativo = $${values.length}`);
  }

  const result = await database.query(
    `SELECT
      c.id,
      c.entrega_id AS "entregaId",
      c.usuario_id AS "usuarioId",
      u.nome AS "enviadoPor",
      e.codigo AS "codigoEntrega",
      e.cliente,
      c.tipo,
      c.arquivo_nome AS "arquivoNome",
      c.arquivo_caminho AS "arquivoCaminho",
      c.mime_type AS "mimeType",
      c.tamanho_bytes AS "tamanhoBytes",
      c.observacao,
      c.ativo,
      c.criado_em AS "criadoEm",
      c.atualizado_em AS "atualizadoEm"
    FROM comprovantes c
    INNER JOIN entregas e ON e.id = c.entrega_id
    INNER JOIN usuarios u ON u.id = c.usuario_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY c.criado_em DESC`,
    values,
  );

  return result.rows.map(mapProof);
}

async function findById(userId, proofId) {
  const result = await database.query(
    `SELECT
      c.id,
      c.entrega_id AS "entregaId",
      c.usuario_id AS "usuarioId",
      u.nome AS "enviadoPor",
      e.codigo AS "codigoEntrega",
      e.cliente,
      c.tipo,
      c.arquivo_nome AS "arquivoNome",
      c.arquivo_caminho AS "arquivoCaminho",
      c.mime_type AS "mimeType",
      c.tamanho_bytes AS "tamanhoBytes",
      c.observacao,
      c.ativo,
      c.criado_em AS "criadoEm",
      c.atualizado_em AS "atualizadoEm"
    FROM comprovantes c
    INNER JOIN entregas e ON e.id = c.entrega_id
    INNER JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.usuario_id = $1 AND c.id = $2`,
    [userId, proofId],
  );

  return mapProof(result.rows[0]);
}

async function findByIdForUser(user, proofId) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return findById(user.id, proofId);
  }

  const proofs = await listForUser(user, { ativo: true });
  return proofs.find((proof) => proof.id === proofId) || null;
}

async function findDeliveryById(userId, entregaId) {
  const result = await database.query(
    `SELECT id, codigo, cliente, status
    FROM entregas
    WHERE usuario_id = $1 AND id = $2`,
    [userId, entregaId],
  );

  return result.rows[0] || null;
}

async function findDeliveryByIdForUser(user, entregaId) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return findDeliveryById(user.id, entregaId);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return null;
  }

  const result = await database.query(
    `SELECT d.id, d.codigo, d.cliente, d.status
    FROM entregas d
    WHERE d.usuario_id = $1
      AND d.id = $2
      AND EXISTS (
        SELECT 1
        FROM rota_entregas re
        INNER JOIN rotas_operacionais r ON r.id = re.rota_id
        WHERE re.entrega_id = d.id
          AND r.motorista_id = $3
      )`,
    [user.id, entregaId, driverId],
  );

  return result.rows[0] || null;
}

async function listDeliveriesForProofs(userId) {
  const result = await database.query(
    `SELECT
      id,
      codigo,
      cliente,
      status
    FROM entregas
    WHERE usuario_id = $1
    ORDER BY criado_em DESC`,
    [userId],
  );

  return result.rows;
}

async function listDeliveriesForUser(user) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return listDeliveriesForProofs(user.id);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return [];
  }

  const result = await database.query(
    `SELECT
      d.id,
      d.codigo,
      d.cliente,
      d.status
    FROM entregas d
    WHERE d.usuario_id = $1
      AND EXISTS (
        SELECT 1
        FROM rota_entregas re
        INNER JOIN rotas_operacionais r ON r.id = re.rota_id
        WHERE re.entrega_id = d.id
          AND r.motorista_id = $2
      )
    ORDER BY d.criado_em DESC`,
    [user.id, driverId],
  );

  return result.rows;
}

async function create(userId, entregaId, payload) {
  const delivery = await findDeliveryById(userId, entregaId);

  if (!delivery) {
    throw new HttpError(404, "Entrega nao encontrada");
  }

  if (!["em_rota", "entregue"].includes(delivery.status)) {
    throw new HttpError(
      409,
      "Comprovantes so podem ser anexados em entregas em_rota ou entregues",
    );
  }

  const result = await database.query(
    `INSERT INTO comprovantes (
      entrega_id,
      usuario_id,
      tipo,
      arquivo_nome,
      arquivo_caminho,
      mime_type,
      tamanho_bytes,
      observacao,
      ativo
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
    RETURNING
      id,
      entrega_id AS "entregaId",
      usuario_id AS "usuarioId",
      tipo,
      arquivo_nome AS "arquivoNome",
      arquivo_caminho AS "arquivoCaminho",
      mime_type AS "mimeType",
      tamanho_bytes AS "tamanhoBytes",
      observacao,
      ativo,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      entregaId,
      userId,
      payload.tipo,
      payload.arquivoNome,
      payload.arquivoCaminho,
      payload.mimeType,
      payload.tamanhoBytes,
      payload.observacao,
    ],
  );

  return findById(userId, result.rows[0].id);
}

async function createForUser(user, entregaId, payload) {
  const delivery = await findDeliveryByIdForUser(user, entregaId);

  if (!delivery) {
    throw new HttpError(404, "Entrega nao encontrada");
  }

  if (!["em_rota", "entregue"].includes(delivery.status)) {
    throw new HttpError(
      409,
      "Comprovantes so podem ser anexados em entregas em_rota ou entregues",
    );
  }

  const result = await database.query(
    `INSERT INTO comprovantes (
      entrega_id,
      usuario_id,
      tipo,
      arquivo_nome,
      arquivo_caminho,
      mime_type,
      tamanho_bytes,
      observacao,
      ativo
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
    RETURNING id`,
    [
      entregaId,
      user.id,
      payload.tipo,
      payload.arquivoNome,
      payload.arquivoCaminho,
      payload.mimeType,
      payload.tamanhoBytes,
      payload.observacao,
    ],
  );

  return findByIdForUser(user, result.rows[0].id);
}

async function updateById(userId, proofId, payload) {
  const fields = [];
  const values = [userId, proofId];
  const mapping = {
    tipo: "tipo",
    observacao: "observacao",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);
  }

  fields.push("atualizado_em = NOW()");

  await database.query(
    `UPDATE comprovantes
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2`,
    values,
  );

  return findById(userId, proofId);
}

async function deactivateById(userId, proofId) {
  const result = await database.query(
    `UPDATE comprovantes
    SET ativo = FALSE, atualizado_em = NOW()
    WHERE usuario_id = $1 AND id = $2 AND ativo = TRUE
    RETURNING id`,
    [userId, proofId],
  );

  return result.rows[0] || null;
}

module.exports = {
  listByUserId,
  listForUser,
  findById,
  findByIdForUser,
  findDeliveryById,
  findDeliveryByIdForUser,
  listDeliveriesForProofs,
  listDeliveriesForUser,
  create,
  createForUser,
  updateById,
  deactivateById,
};
