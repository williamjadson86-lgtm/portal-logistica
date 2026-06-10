const database = require("../config/database");
const HttpError = require("../errors/HttpError");

function mapFinancialEntry(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    usuarioId: row.usuarioId,
    clienteId: row.clienteId,
    entregaId: row.entregaId,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: Number(row.valor || 0),
    status: row.status,
    dataCompetencia: row.dataCompetencia,
    dataVencimento: row.dataVencimento,
    dataPagamento: row.dataPagamento,
    observacoes: row.observacoes || "",
    cliente: row.clienteId
      ? {
          id: row.clienteId,
          nome: row.clienteNome,
          documento: row.clienteDocumento,
          status: row.clienteStatus,
        }
      : null,
    entrega: row.entregaId
      ? {
          id: row.entregaId,
          codigo: row.entregaCodigo,
          cliente: row.entregaCliente,
          status: row.entregaStatus,
          valorFrete: row.entregaValorFrete != null ? Number(row.entregaValorFrete) : null,
        }
      : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function findClientById(userId, clientId) {
  const result = await database.query(
    `SELECT id, nome, documento, status
    FROM clientes
    WHERE usuario_id = $1 AND id = $2`,
    [userId, clientId],
  );

  return result.rows[0] || null;
}

async function findClientByName(userId, clientName) {
  const result = await database.query(
    `SELECT id, nome, documento, status
    FROM clientes
    WHERE usuario_id = $1 AND LOWER(nome) = LOWER($2)
    ORDER BY criado_em ASC
    LIMIT 1`,
    [userId, clientName],
  );

  return result.rows[0] || null;
}

async function findDeliveryById(userId, deliveryId) {
  const result = await database.query(
    `SELECT
      id,
      codigo,
      cliente,
      status,
      TO_CHAR(previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      valor_frete AS "valorFrete"
    FROM entregas
    WHERE usuario_id = $1 AND id = $2`,
    [userId, deliveryId],
  );

  return result.rows[0] || null;
}

async function ensureActiveDeliveryFinancialUniqueness(userId, entregaId, excludedId = null) {
  if (!entregaId) {
    return;
  }

  const values = [userId, entregaId];
  let query = `SELECT id
    FROM lancamentos_financeiros
    WHERE usuario_id = $1
      AND entrega_id = $2
      AND status <> 'cancelado'`;

  if (excludedId) {
    values.push(excludedId);
    query += ` AND id <> $3`;
  }

  query += " LIMIT 1";

  const result = await database.query(query, values);
  if (result.rowCount > 0) {
    throw new HttpError(409, "Ja existe lancamento financeiro ativo para esta entrega");
  }
}

async function resolveLinkedEntities(userId, payload, options = {}) {
  const { excludedFinancialId = null } = options;
  let client = null;
  let delivery = null;

  if (payload.clienteId) {
    client = await findClientById(userId, payload.clienteId);
    if (!client) {
      throw new HttpError(404, "Cliente nao encontrado");
    }
  }

  if (payload.entregaId) {
    delivery = await findDeliveryById(userId, payload.entregaId);
    if (!delivery) {
      throw new HttpError(404, "Entrega nao encontrada");
    }

    await ensureActiveDeliveryFinancialUniqueness(
      userId,
      payload.entregaId,
      excludedFinancialId,
    );

    if (!client) {
      client = await findClientByName(userId, delivery.cliente);
    }
  }

  return { client, delivery };
}

function buildSelectQuery() {
  return `SELECT
      lf.id,
      lf.usuario_id AS "usuarioId",
      lf.cliente_id AS "clienteId",
      lf.entrega_id AS "entregaId",
      lf.tipo,
      lf.descricao,
      lf.valor,
      lf.status,
      TO_CHAR(lf.data_competencia, 'YYYY-MM-DD') AS "dataCompetencia",
      TO_CHAR(lf.data_vencimento, 'YYYY-MM-DD') AS "dataVencimento",
      TO_CHAR(lf.data_pagamento, 'YYYY-MM-DD') AS "dataPagamento",
      lf.observacoes,
      c.nome AS "clienteNome",
      c.documento AS "clienteDocumento",
      c.status AS "clienteStatus",
      e.codigo AS "entregaCodigo",
      e.cliente AS "entregaCliente",
      e.status AS "entregaStatus",
      e.valor_frete AS "entregaValorFrete",
      lf.criado_em AS "criadoEm",
      lf.atualizado_em AS "atualizadoEm"
    FROM lancamentos_financeiros lf
    LEFT JOIN clientes c ON c.id = lf.cliente_id
    LEFT JOIN entregas e ON e.id = lf.entrega_id`;
}

async function listByUserId(userId, filters = {}) {
  const conditions = ["lf.usuario_id = $1"];
  const values = [userId];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`lf.status = $${values.length}`);
  }

  if (filters.tipo) {
    values.push(filters.tipo);
    conditions.push(`lf.tipo = $${values.length}`);
  }

  if (filters.clienteId) {
    values.push(filters.clienteId);
    conditions.push(`lf.cliente_id = $${values.length}`);
  }

  if (filters.dataInicio) {
    values.push(filters.dataInicio);
    conditions.push(`lf.data_competencia >= $${values.length}::date`);
  }

  if (filters.dataFim) {
    values.push(filters.dataFim);
    conditions.push(`lf.data_competencia <= $${values.length}::date`);
  }

  const result = await database.query(
    `${buildSelectQuery()}
    WHERE ${conditions.join(" AND ")}
    ORDER BY lf.data_competencia DESC, lf.criado_em DESC`,
    values,
  );

  return result.rows.map(mapFinancialEntry);
}

async function findById(userId, financialId) {
  const result = await database.query(
    `${buildSelectQuery()}
    WHERE lf.usuario_id = $1 AND lf.id = $2`,
    [userId, financialId],
  );

  return mapFinancialEntry(result.rows[0]);
}

async function create(userId, payload) {
  const { client, delivery } = await resolveLinkedEntities(userId, payload);
  const status = payload.status || "pendente";
  const dataPagamento =
    status === "pago"
      ? payload.dataPagamento || new Date().toISOString().slice(0, 10)
      : payload.dataPagamento || null;

  const result = await database.query(
    `INSERT INTO lancamentos_financeiros (
      usuario_id,
      cliente_id,
      entrega_id,
      tipo,
      descricao,
      valor,
      status,
      data_competencia,
      data_vencimento,
      data_pagamento,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      userId,
      client?.id || null,
      payload.entregaId || null,
      payload.tipo || "receita",
      payload.descricao,
      payload.valor,
      status,
      payload.dataCompetencia,
      payload.dataVencimento || null,
      dataPagamento,
      payload.observacoes || null,
    ],
  );

  return findById(userId, result.rows[0].id);
}

async function updateById(userId, financialId, payload) {
  const current = await findById(userId, financialId);
  if (!current) {
    return null;
  }

  const mergedPayload = {
    clienteId: Object.hasOwn(payload, "clienteId") ? payload.clienteId : current.clienteId,
    entregaId: Object.hasOwn(payload, "entregaId") ? payload.entregaId : current.entregaId,
  };
  const { client } = await resolveLinkedEntities(userId, mergedPayload, {
    excludedFinancialId: financialId,
  });

  const fields = [];
  const values = [userId, financialId];
  const mapping = {
    clienteId: "cliente_id",
    entregaId: "entrega_id",
    tipo: "tipo",
    descricao: "descricao",
    valor: "valor",
    status: "status",
    dataCompetencia: "data_competencia",
    dataVencimento: "data_vencimento",
    observacoes: "observacoes",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    const value =
      key === "clienteId"
        ? client?.id || null
        : key === "entregaId"
          ? payload.entregaId || null
          : payload[key];

    values.push(value);
    fields.push(`${column} = $${values.length}`);
  }

  if (Object.hasOwn(payload, "dataPagamento")) {
    values.push(payload.dataPagamento || null);
    fields.push(`data_pagamento = $${values.length}`);
  } else if (payload.status === "pago") {
    values.push(new Date().toISOString().slice(0, 10));
    fields.push(`data_pagamento = $${values.length}`);
  } else if (payload.status && payload.status !== "pago") {
    fields.push("data_pagamento = NULL");
  }

  fields.push("atualizado_em = NOW()");

  await database.query(
    `UPDATE lancamentos_financeiros
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2`,
    values,
  );

  return findById(userId, financialId);
}

async function updateStatusById(userId, financialId, status, dataPagamento = null) {
  const values = [userId, financialId, status];
  const fields = ["status = $3", "atualizado_em = NOW()"];

  if (status === "pago") {
    values.push(dataPagamento || new Date().toISOString().slice(0, 10));
    fields.push(`data_pagamento = $${values.length}`);
  } else {
    fields.push("data_pagamento = NULL");
  }

  const result = await database.query(
    `UPDATE lancamentos_financeiros
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    values,
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findById(userId, financialId);
}

async function cancelById(userId, financialId) {
  return updateStatusById(userId, financialId, "cancelado");
}

async function cancelPendingByDeliveryId(userId, deliveryId) {
  const result = await database.query(
    `UPDATE lancamentos_financeiros
    SET status = 'cancelado',
        data_pagamento = NULL,
        atualizado_em = NOW()
    WHERE usuario_id = $1
      AND entrega_id = $2
      AND status = 'pendente'
    RETURNING id`,
    [userId, deliveryId],
  );

  return result.rows;
}

async function createFromDelivery(userId, deliveryId, payload = {}) {
  const delivery = await findDeliveryById(userId, deliveryId);
  if (!delivery) {
    throw new HttpError(404, "Entrega nao encontrada");
  }

  if (delivery.status !== "entregue") {
    throw new HttpError(409, "A entrega precisa estar concluida para gerar lancamento");
  }

  await ensureActiveDeliveryFinancialUniqueness(userId, deliveryId);

  const linkedClient = payload.clienteId
    ? await findClientById(userId, payload.clienteId)
    : await findClientByName(userId, delivery.cliente);

  if (payload.clienteId && !linkedClient) {
    throw new HttpError(404, "Cliente nao encontrado");
  }

  const valor = payload.valor ?? (delivery.valorFrete != null ? Number(delivery.valorFrete) : null);
  if (valor == null || Number(valor) <= 0) {
    throw new HttpError(
      400,
      "Informe um valor valido ou cadastre valor_frete na entrega antes de gerar o lancamento",
    );
  }

  const result = await database.query(
    `INSERT INTO lancamentos_financeiros (
      usuario_id,
      cliente_id,
      entrega_id,
      tipo,
      descricao,
      valor,
      status,
      data_competencia,
      data_vencimento,
      data_pagamento,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7, $8, NULL, $9)
    RETURNING id`,
    [
      userId,
      linkedClient?.id || null,
      deliveryId,
      payload.tipo || "receita",
      payload.descricao || `Frete da entrega ${delivery.codigo}`,
      Number(valor),
      payload.dataCompetencia || new Date().toISOString().slice(0, 10),
      payload.dataVencimento || null,
      payload.observacoes || null,
    ],
  );

  return findById(userId, result.rows[0].id);
}

async function listSupportData(userId) {
  const [clientsResult, deliveriesResult] = await Promise.all([
    database.query(
      `SELECT id, nome, documento, status
      FROM clientes
      WHERE usuario_id = $1
      ORDER BY nome ASC`,
      [userId],
    ),
    database.query(
      `SELECT
        e.id,
        e.codigo,
        e.cliente,
        e.status,
        TO_CHAR(e.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
        e.valor_frete AS "valorFrete",
        EXISTS (
          SELECT 1
          FROM lancamentos_financeiros lf
          WHERE lf.entrega_id = e.id
            AND lf.status <> 'cancelado'
        ) AS "temLancamentoAtivo"
      FROM entregas e
      WHERE e.usuario_id = $1
      ORDER BY e.previsao_entrega DESC NULLS LAST, e.codigo ASC`,
      [userId],
    ),
  ]);

  return {
    clientes: clientsResult.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      documento: row.documento,
      status: row.status,
    })),
    entregas: deliveriesResult.rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      cliente: row.cliente,
      status: row.status,
      dataPrevista: row.dataPrevista,
      valorFrete: row.valorFrete != null ? Number(row.valorFrete) : null,
      temLancamentoAtivo: row.temLancamentoAtivo,
    })),
  };
}

module.exports = {
  listByUserId,
  findById,
  create,
  updateById,
  updateStatusById,
  cancelById,
  cancelPendingByDeliveryId,
  createFromDelivery,
  listSupportData,
};
