const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const { USER_ROLES } = require("../config/permissions");
const { findLinkedDriverId } = require("./driverAccessRepository");

function mapLinkedClient(row) {
  if (!row?.clienteId) {
    return null;
  }

  return {
    id: row.clienteId,
    nome: row.clienteNome || row.cliente,
    documento: row.clienteDocumento || null,
    status: row.clienteStatus || null,
  };
}

function mapDelivery(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    codigo: row.codigo,
    clienteId: row.clienteId || null,
    cliente: row.cliente,
    clienteCadastro: mapLinkedClient(row),
    origem: row.origem,
    destino: row.destino,
    cidade: row.cidade,
    estado: row.estado,
    status: row.status,
    dataPrevista: row.dataPrevista,
    valorFrete: row.valorFrete != null ? Number(row.valorFrete) : null,
    observacoes: row.observacoes || "",
    rotaAtual:
      row.rotaId || row.rotaCodigo
        ? {
            id: row.rotaId,
            codigo: row.rotaCodigo,
            status: row.rotaStatus,
            dataRota: row.rotaData,
          }
        : null,
    motorista:
      row.motoristaId || row.motoristaNome
        ? {
            id: row.motoristaId,
            nome: row.motoristaNome,
          }
        : null,
    veiculo:
      row.veiculoId || row.veiculoPlaca
        ? {
            id: row.veiculoId,
            placa: row.veiculoPlaca,
            modelo: row.veiculoModelo,
          }
        : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function findClientById(userId, clientId, client = database) {
  const result = await client.query(
    `SELECT id, nome, documento, status
    FROM clientes
    WHERE usuario_id = $1 AND id = $2`,
    [userId, clientId],
  );

  return result.rows[0] || null;
}

async function resolveClientReference(userId, payload, options = {}) {
  const { client = database, fallbackClientName = null } = options;

  if (Object.hasOwn(payload, "clienteId")) {
    if (payload.clienteId === null) {
      return {
        clienteId: null,
        cliente: Object.hasOwn(payload, "cliente") ? payload.cliente : fallbackClientName,
      };
    }

    const linkedClient = await findClientById(userId, payload.clienteId, client);
    if (!linkedClient) {
      throw new HttpError(404, "Cliente nao encontrado");
    }

    return {
      clienteId: linkedClient.id,
      cliente: linkedClient.nome,
    };
  }

  if (Object.hasOwn(payload, "cliente")) {
    return {
      clienteId: undefined,
      cliente: payload.cliente,
    };
  }

  return {
    clienteId: undefined,
    cliente: undefined,
  };
}

function buildDeliverySelect() {
  return `SELECT
      d.id,
      d.codigo,
      d.cliente_id AS "clienteId",
      d.cliente,
      c.nome AS "clienteNome",
      c.documento AS "clienteDocumento",
      c.status AS "clienteStatus",
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      d.status,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      d.valor_frete AS "valorFrete",
      COALESCE(d.observacoes, d.descricao, '') AS observacoes,
      d.criado_em AS "criadoEm",
      d.atualizado_em AS "atualizadoEm"`;
}

async function getDashboardSummary(userId) {
  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'em_transito')::int AS "emTransito",
      COUNT(*) FILTER (WHERE status = 'entregue')::int AS entregues,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes
    FROM entregas
    WHERE usuario_id = $1`,
    [userId],
  );

  return result.rows[0];
}

async function getDashboardSummaryForUser(user) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return getDashboardSummary(user.id);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return {
      total: 0,
      emTransito: 0,
      entregues: 0,
      pendentes: 0,
    };
  }

  const result = await database.query(
    `SELECT
      COUNT(DISTINCT d.id)::int AS total,
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'em_transito')::int AS "emTransito",
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'entregue')::int AS entregues,
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'pendente')::int AS pendentes
    FROM entregas d
    INNER JOIN rota_entregas re ON re.entrega_id = d.id
    INNER JOIN rotas_operacionais r ON r.id = re.rota_id
    WHERE d.usuario_id = $1
      AND r.motorista_id = $2`,
    [user.id, driverId],
  );

  return result.rows[0];
}

async function listByUserId(userId) {
  const result = await database.query(
    `${buildDeliverySelect()}
    FROM entregas d
    LEFT JOIN clientes c
      ON c.id = d.cliente_id
    WHERE d.usuario_id = $1
    ORDER BY d.previsao_entrega ASC NULLS LAST, d.criado_em DESC`,
    [userId],
  );

  return result.rows.map(mapDelivery);
}

async function listForUser(user) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return listByUserId(user.id);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return [];
  }

  const result = await database.query(
    `${buildDeliverySelect()}
    FROM entregas d
    LEFT JOIN clientes c
      ON c.id = d.cliente_id
    WHERE d.usuario_id = $1
      AND EXISTS (
        SELECT 1
        FROM rota_entregas re
        INNER JOIN rotas_operacionais r ON r.id = re.rota_id
        WHERE re.entrega_id = d.id
          AND r.motorista_id = $2
      )
    ORDER BY d.previsao_entrega ASC NULLS LAST, d.criado_em DESC`,
    [user.id, driverId],
  );

  return result.rows.map(mapDelivery);
}

async function findById(userId, deliveryId) {
  const result = await database.query(
    `SELECT
      d.id,
      d.codigo,
      d.cliente_id AS "clienteId",
      d.cliente,
      c.nome AS "clienteNome",
      c.documento AS "clienteDocumento",
      c.status AS "clienteStatus",
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      d.status,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      d.valor_frete AS "valorFrete",
      COALESCE(d.observacoes, d.descricao, '') AS observacoes,
      r.id AS "rotaId",
      r.codigo AS "rotaCodigo",
      r.status AS "rotaStatus",
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "rotaData",
      m.id AS "motoristaId",
      m.nome AS "motoristaNome",
      v.id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      v.modelo AS "veiculoModelo",
      d.criado_em AS "criadoEm",
      d.atualizado_em AS "atualizadoEm"
    FROM entregas d
    LEFT JOIN clientes c
      ON c.id = d.cliente_id
    LEFT JOIN rota_entregas re
      ON re.entrega_id = d.id
      AND re.ativo = TRUE
    LEFT JOIN rotas_operacionais r
      ON r.id = re.rota_id
      AND r.usuario_id = d.usuario_id
    LEFT JOIN motoristas m
      ON m.id = r.motorista_id
    LEFT JOIN veiculos v
      ON v.id = r.veiculo_id
    WHERE d.usuario_id = $1 AND d.id = $2`,
    [userId, deliveryId],
  );

  return mapDelivery(result.rows[0]);
}

async function findByIdForUser(user, deliveryId) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return findById(user.id, deliveryId);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return null;
  }

  const result = await database.query(
    `SELECT
      d.id,
      d.codigo,
      d.cliente_id AS "clienteId",
      d.cliente,
      c.nome AS "clienteNome",
      c.documento AS "clienteDocumento",
      c.status AS "clienteStatus",
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      d.status,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      d.valor_frete AS "valorFrete",
      COALESCE(d.observacoes, d.descricao, '') AS observacoes,
      r.id AS "rotaId",
      r.codigo AS "rotaCodigo",
      r.status AS "rotaStatus",
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "rotaData",
      m.id AS "motoristaId",
      m.nome AS "motoristaNome",
      v.id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      v.modelo AS "veiculoModelo",
      d.criado_em AS "criadoEm",
      d.atualizado_em AS "atualizadoEm"
    FROM entregas d
    LEFT JOIN clientes c
      ON c.id = d.cliente_id
    LEFT JOIN rota_entregas re
      ON re.entrega_id = d.id
    LEFT JOIN rotas_operacionais r
      ON r.id = re.rota_id
      AND r.usuario_id = d.usuario_id
    LEFT JOIN motoristas m
      ON m.id = r.motorista_id
    LEFT JOIN veiculos v
      ON v.id = r.veiculo_id
    WHERE d.usuario_id = $1
      AND d.id = $2
      AND r.motorista_id = $3
    ORDER BY re.ativo DESC
    LIMIT 1`,
    [user.id, deliveryId, driverId],
  );

  return mapDelivery(result.rows[0]);
}

async function create(userId, payload) {
  const resolvedClient = await resolveClientReference(userId, payload);

  const result = await database.query(
    `INSERT INTO entregas (
      usuario_id,
      codigo,
      cliente_id,
      cliente,
      descricao,
      origem,
      destino,
      cidade,
      estado,
      status,
      previsao_entrega,
      valor_frete,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      userId,
      payload.codigo,
      resolvedClient.clienteId || null,
      resolvedClient.cliente,
      payload.observacoes,
      payload.origem,
      payload.destino,
      payload.cidade,
      payload.estado,
      payload.status,
      payload.dataPrevista,
      payload.valorFrete ?? null,
      payload.observacoes,
    ],
  );

  return findById(userId, result.rows[0].id);
}

async function updateById(userId, deliveryId, payload) {
  const current = await findById(userId, deliveryId);
  if (!current) {
    return null;
  }

  const resolvedClient = await resolveClientReference(userId, payload, {
    fallbackClientName: current.cliente,
  });

  const fields = [];
  const values = [userId, deliveryId];
  const mapping = {
    codigo: "codigo",
    origem: "origem",
    destino: "destino",
    cidade: "cidade",
    estado: "estado",
    status: "status",
    dataPrevista: "previsao_entrega",
    valorFrete: "valor_frete",
    observacoes: "observacoes",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);

    if (key === "observacoes") {
      values.push(payload[key]);
      fields.push(`descricao = $${values.length}`);
    }
  }

  if (Object.hasOwn(payload, "clienteId") || Object.hasOwn(payload, "cliente")) {
    if (Object.hasOwn(resolvedClient, "clienteId")) {
      values.push(resolvedClient.clienteId);
      fields.push(`cliente_id = $${values.length}`);
    }

    if (typeof resolvedClient.cliente === "string" && resolvedClient.cliente) {
      values.push(resolvedClient.cliente);
      fields.push(`cliente = $${values.length}`);
    }
  }

  values.push(new Date().toISOString());
  fields.push(`atualizado_em = $${values.length}`);

  const result = await database.query(
    `UPDATE entregas
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    values,
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findById(userId, deliveryId);
}

async function updateStatusById(userId, deliveryId, status) {
  const result = await database.query(
    `UPDATE entregas
    SET status = $3, atualizado_em = NOW()
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    [userId, deliveryId, status],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findById(userId, deliveryId);
}

async function deleteById(userId, deliveryId) {
  const result = await database.query(
    `DELETE FROM entregas
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    [userId, deliveryId],
  );

  return result.rows[0] || null;
}

module.exports = {
  getDashboardSummary,
  getDashboardSummaryForUser,
  listByUserId,
  listForUser,
  findById,
  findByIdForUser,
  create,
  updateById,
  updateStatusById,
  deleteById,
};
