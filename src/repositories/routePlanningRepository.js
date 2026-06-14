const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const { USER_ROLES } = require("../config/permissions");
const { findLinkedDriverId } = require("./driverAccessRepository");

const ELIGIBLE_DELIVERY_STATUSES = ["pendente", "coletada", "em_transito"];

function mapRoute(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    codigo: row.codigo,
    motoristaId: row.motoristaId,
    motoristaNome: row.motoristaNome,
    veiculoId: row.veiculoId,
    veiculoPlaca: row.veiculoPlaca,
    origem: row.origem,
    destino: row.destino,
    dataRota: row.dataRota,
    status: row.status,
    observacoes: row.observacoes || "",
    totalEntregasAtivas: Number(row.totalEntregasAtivas || 0),
    totalEntregasHistorico: Number(row.totalEntregasHistorico || 0),
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function mapLinkedDelivery(row) {
  return {
    relacaoId: row.relacaoId,
    id: row.id,
    codigo: row.codigo,
    cliente: row.cliente,
    origem: row.origem,
    destino: row.destino,
    cidade: row.cidade,
    estado: row.estado,
    status: row.status,
    dataPrevista: row.dataPrevista,
    observacoes: row.observacoes || "",
    ativo: row.ativo,
    vinculadoEm: row.vinculadoEm,
    desvinculadoEm: row.desvinculadoEm,
  };
}

async function getSupportData(userId, client = database) {
  const [driversResult, vehiclesResult, deliveriesResult] = await Promise.all([
    client.query(
      `SELECT id, nome
      FROM motoristas
      WHERE usuario_id = $1 AND status = 'ativo'
      ORDER BY nome ASC`,
      [userId],
    ),
    client.query(
      `SELECT id, placa, modelo
      FROM veiculos
      WHERE usuario_id = $1 AND status = 'disponivel'
      ORDER BY placa ASC`,
      [userId],
    ),
    client.query(
      `SELECT
        d.id,
        d.codigo,
        d.cliente,
        d.status,
        TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista"
      FROM entregas d
      WHERE d.usuario_id = $1
        AND d.status = ANY($2::text[])
        AND NOT EXISTS (
          SELECT 1
          FROM rota_entregas re
          WHERE re.entrega_id = d.id
            AND re.ativo = TRUE
        )
      ORDER BY d.previsao_entrega ASC NULLS LAST, d.codigo ASC`,
      [userId, ELIGIBLE_DELIVERY_STATUSES],
    ),
  ]);

  return {
    motoristas: driversResult.rows.map((row) => ({ id: row.id, nome: row.nome })),
    veiculos: vehiclesResult.rows.map((row) => ({
      id: row.id,
      placa: row.placa,
      modelo: row.modelo,
    })),
    entregasDisponiveis: deliveriesResult.rows,
  };
}

async function getDashboardSummary(userId) {
  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'planejada')::int AS planejadas,
      COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS "emAndamento",
      COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas
    FROM rotas_operacionais
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
      planejadas: 0,
      emAndamento: 0,
      concluidas: 0,
    };
  }

  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'planejada')::int AS planejadas,
      COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS "emAndamento",
      COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas
    FROM rotas_operacionais
    WHERE usuario_id = $1
      AND motorista_id = $2`,
    [user.id, driverId],
  );

  return result.rows[0];
}

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      r.id,
      r.codigo,
      r.motorista_id AS "motoristaId",
      m.nome AS "motoristaNome",
      r.veiculo_id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      r.origem,
      r.destino,
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "dataRota",
      r.status,
      r.observacoes,
      COUNT(re.id) FILTER (WHERE re.ativo = TRUE)::int AS "totalEntregasAtivas",
      COUNT(re.id)::int AS "totalEntregasHistorico",
      r.criado_em AS "criadoEm",
      r.atualizado_em AS "atualizadoEm"
    FROM rotas_operacionais r
    LEFT JOIN motoristas m ON m.id = r.motorista_id
    LEFT JOIN veiculos v ON v.id = r.veiculo_id
    LEFT JOIN rota_entregas re ON re.rota_id = r.id
    WHERE r.usuario_id = $1
    GROUP BY r.id, m.nome, v.placa
    ORDER BY r.data_rota DESC, r.criado_em DESC`,
    [userId],
  );

  return result.rows.map(mapRoute);
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
    `SELECT
      r.id,
      r.codigo,
      r.motorista_id AS "motoristaId",
      m.nome AS "motoristaNome",
      r.veiculo_id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      r.origem,
      r.destino,
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "dataRota",
      r.status,
      r.observacoes,
      COUNT(re.id) FILTER (WHERE re.ativo = TRUE)::int AS "totalEntregasAtivas",
      COUNT(re.id)::int AS "totalEntregasHistorico",
      r.criado_em AS "criadoEm",
      r.atualizado_em AS "atualizadoEm"
    FROM rotas_operacionais r
    LEFT JOIN motoristas m ON m.id = r.motorista_id
    LEFT JOIN veiculos v ON v.id = r.veiculo_id
    LEFT JOIN rota_entregas re ON re.rota_id = r.id
    WHERE r.usuario_id = $1
      AND r.motorista_id = $2
    GROUP BY r.id, m.nome, v.placa
    ORDER BY r.data_rota DESC, r.criado_em DESC`,
    [user.id, driverId],
  );

  return result.rows.map(mapRoute);
}

async function findById(userId, routeId, client = database) {
  const routeResult = await client.query(
    `SELECT
      r.id,
      r.codigo,
      r.motorista_id AS "motoristaId",
      m.nome AS "motoristaNome",
      r.veiculo_id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      r.origem,
      r.destino,
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "dataRota",
      r.status,
      r.observacoes,
      COUNT(re.id) FILTER (WHERE re.ativo = TRUE)::int AS "totalEntregasAtivas",
      COUNT(re.id)::int AS "totalEntregasHistorico",
      r.criado_em AS "criadoEm",
      r.atualizado_em AS "atualizadoEm"
    FROM rotas_operacionais r
    LEFT JOIN motoristas m ON m.id = r.motorista_id
    LEFT JOIN veiculos v ON v.id = r.veiculo_id
    LEFT JOIN rota_entregas re ON re.rota_id = r.id
    WHERE r.usuario_id = $1 AND r.id = $2
    GROUP BY r.id, m.nome, v.placa`,
    [userId, routeId],
  );

  const route = mapRoute(routeResult.rows[0]);
  if (!route) {
    return null;
  }

  const deliveriesResult = await client.query(
    `SELECT
      re.id AS "relacaoId",
      re.ativo,
      re.vinculado_em AS "vinculadoEm",
      re.desvinculado_em AS "desvinculadoEm",
      d.id,
      d.codigo,
      d.cliente,
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      d.status,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      COALESCE(d.observacoes, d.descricao, '') AS observacoes
    FROM rota_entregas re
    INNER JOIN entregas d ON d.id = re.entrega_id
    WHERE re.usuario_id = $1 AND re.rota_id = $2
    ORDER BY re.ativo DESC, re.vinculado_em DESC`,
    [userId, routeId],
  );

  return {
    ...route,
    entregas: deliveriesResult.rows.map(mapLinkedDelivery),
  };
}

async function findByIdForUser(user, routeId, client = database) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return findById(user.id, routeId, client);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return null;
  }

  const routeResult = await client.query(
    `SELECT
      r.id,
      r.codigo,
      r.motorista_id AS "motoristaId",
      m.nome AS "motoristaNome",
      r.veiculo_id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      r.origem,
      r.destino,
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "dataRota",
      r.status,
      r.observacoes,
      COUNT(re.id) FILTER (WHERE re.ativo = TRUE)::int AS "totalEntregasAtivas",
      COUNT(re.id)::int AS "totalEntregasHistorico",
      r.criado_em AS "criadoEm",
      r.atualizado_em AS "atualizadoEm"
    FROM rotas_operacionais r
    LEFT JOIN motoristas m ON m.id = r.motorista_id
    LEFT JOIN veiculos v ON v.id = r.veiculo_id
    LEFT JOIN rota_entregas re ON re.rota_id = r.id
    WHERE r.usuario_id = $1
      AND r.id = $2
      AND r.motorista_id = $3
    GROUP BY r.id, m.nome, v.placa`,
    [user.id, routeId, driverId],
  );

  const route = mapRoute(routeResult.rows[0]);
  if (!route) {
    return null;
  }

  const deliveriesResult = await client.query(
    `SELECT
      re.id AS "relacaoId",
      re.ativo,
      re.vinculado_em AS "vinculadoEm",
      re.desvinculado_em AS "desvinculadoEm",
      d.id,
      d.codigo,
      d.cliente,
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      d.status,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      COALESCE(d.observacoes, d.descricao, '') AS observacoes
    FROM rota_entregas re
    INNER JOIN entregas d ON d.id = re.entrega_id
    WHERE re.usuario_id = $1
      AND re.rota_id = $2
    ORDER BY re.ativo DESC, re.vinculado_em DESC`,
    [user.id, routeId],
  );

  return {
    ...route,
    entregas: deliveriesResult.rows.map(mapLinkedDelivery),
  };
}

async function getSupportDataForUser(user, client = database) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return getSupportData(user.id, client);
  }

  return {
    motoristas: [],
    veiculos: [],
    entregasDisponiveis: [],
  };
}

async function ensureDriverActive(client, userId, motoristaId) {
  const result = await client.query(
    `SELECT id
    FROM motoristas
    WHERE usuario_id = $1 AND id = $2 AND status = 'ativo'`,
    [userId, motoristaId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(400, "Motorista informado nao esta ativo");
  }
}

async function ensureVehicleAvailable(client, userId, veiculoId) {
  const result = await client.query(
    `SELECT id
    FROM veiculos
    WHERE usuario_id = $1 AND id = $2 AND status = 'disponivel'`,
    [userId, veiculoId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(400, "Veiculo informado nao esta disponivel");
  }
}

async function ensureRouteExistsForUpdate(client, userId, routeId) {
  const result = await client.query(
    `SELECT id, status, veiculo_id AS "veiculoId", motorista_id AS "motoristaId"
    FROM rotas_operacionais
    WHERE usuario_id = $1 AND id = $2
    FOR UPDATE`,
    [userId, routeId],
  );

  const route = result.rows[0];
  if (!route) {
    throw new HttpError(404, "Rota nao encontrada");
  }

  return route;
}

async function create(userId, payload) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    await ensureDriverActive(client, userId, payload.motoristaId);
    await ensureVehicleAvailable(client, userId, payload.veiculoId);

    const result = await client.query(
      `INSERT INTO rotas_operacionais (
        usuario_id,
        codigo,
        motorista_id,
        veiculo_id,
        origem,
        destino,
        data_rota,
        status,
        observacoes,
        nome,
        distancia_km
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'planejada', $8, $2, 0)
      RETURNING id`,
      [
        userId,
        payload.codigo,
        payload.motoristaId,
        payload.veiculoId,
        payload.origem,
        payload.destino,
        payload.dataRota,
        payload.observacoes,
      ],
    );

    const route = await findById(userId, result.rows[0].id, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: route, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateById(userId, routeId, payload) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Apenas rotas planejadas podem ser editadas");
    }

    if (payload.motoristaId) {
      await ensureDriverActive(client, userId, payload.motoristaId);
    }

    if (payload.veiculoId) {
      await ensureVehicleAvailable(client, userId, payload.veiculoId);
    }

    const fields = [];
    const values = [userId, routeId];
    const mapping = {
      codigo: "codigo",
      motoristaId: "motorista_id",
      veiculoId: "veiculo_id",
      origem: "origem",
      destino: "destino",
      dataRota: "data_rota",
      observacoes: "observacoes",
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (!Object.hasOwn(payload, key)) {
        continue;
      }

      values.push(payload[key]);
      fields.push(`${column} = $${values.length}`);

      if (key === "codigo") {
        values.push(payload[key]);
        fields.push(`nome = $${values.length}`);
      }
    }

    fields.push("atualizado_em = NOW()");

    await client.query(
      `UPDATE rotas_operacionais
      SET ${fields.join(", ")}
      WHERE usuario_id = $1 AND id = $2`,
      values,
    );

    const updated = await findById(userId, routeId, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteById(userId, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Apenas rotas planejadas podem ser excluidas");
    }

    await client.query(`DELETE FROM rota_entregas WHERE usuario_id = $1 AND rota_id = $2`, [
      userId,
      routeId,
    ]);
    const result = await client.query(
      `DELETE FROM rotas_operacionais
      WHERE usuario_id = $1 AND id = $2
      RETURNING id`,
      [userId, routeId],
    );

    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addDeliveries(userId, routeId, entregaIds) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Somente rotas planejadas aceitam novas entregas");
    }

    const deliveriesResult = await client.query(
      `SELECT id, codigo, status
      FROM entregas
      WHERE usuario_id = $1 AND id = ANY($2::uuid[])`,
      [userId, entregaIds],
    );

    if (deliveriesResult.rowCount !== entregaIds.length) {
      throw new HttpError(404, "Uma ou mais entregas nao foram encontradas");
    }

    const invalidStatus = deliveriesResult.rows.find(
      (delivery) => !ELIGIBLE_DELIVERY_STATUSES.includes(delivery.status),
    );

    if (invalidStatus) {
      throw new HttpError(
        409,
        `Entrega ${invalidStatus.codigo} nao pode ser vinculada com o status atual`,
      );
    }

    const activeBindings = await client.query(
      `SELECT d.codigo
      FROM rota_entregas re
      INNER JOIN entregas d ON d.id = re.entrega_id
      WHERE re.entrega_id = ANY($1::uuid[])
        AND re.ativo = TRUE`,
      [entregaIds],
    );

    if (activeBindings.rowCount > 0) {
      throw new HttpError(
        409,
        `Entrega ${activeBindings.rows[0].codigo} ja esta vinculada a uma rota ativa`,
      );
    }

    for (const entregaId of entregaIds) {
      await client.query(
        `INSERT INTO rota_entregas (usuario_id, rota_id, entrega_id)
        VALUES ($1, $2, $3)`,
        [userId, routeId, entregaId],
      );
    }

    const updated = await findById(userId, routeId, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeDelivery(userId, routeId, entregaId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Somente rotas planejadas permitem remover entregas");
    }

    const result = await client.query(
      `UPDATE rota_entregas
      SET ativo = FALSE, desvinculado_em = NOW()
      WHERE usuario_id = $1
        AND rota_id = $2
        AND entrega_id = $3
        AND ativo = TRUE
      RETURNING id`,
      [userId, routeId, entregaId],
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "Entrega nao esta vinculada a esta rota");
    }

    const updated = await findById(userId, routeId, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function startRoute(userId, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Somente rotas planejadas podem ser iniciadas");
    }

    const deliveriesResult = await client.query(
      `SELECT d.id, d.codigo, d.status
      FROM rota_entregas re
      INNER JOIN entregas d ON d.id = re.entrega_id
      WHERE re.usuario_id = $1 AND re.rota_id = $2 AND re.ativo = TRUE`,
      [userId, routeId],
    );

    if (deliveriesResult.rowCount === 0) {
      throw new HttpError(409, "Nao e possivel iniciar rota sem entregas vinculadas");
    }

    const invalidDelivery = deliveriesResult.rows.find(
      (delivery) => !ELIGIBLE_DELIVERY_STATUSES.includes(delivery.status),
    );

    if (invalidDelivery) {
      throw new HttpError(
        409,
        `Entrega ${invalidDelivery.codigo} nao pode iniciar a rota com o status atual`,
      );
    }

    await ensureDriverActive(client, userId, route.motoristaId);
    await ensureVehicleAvailable(client, userId, route.veiculoId);

    const overlaps = await client.query(
      `SELECT codigo
      FROM rotas_operacionais
      WHERE usuario_id = $1
        AND id <> $2
        AND status = 'em_andamento'
        AND (motorista_id = $3 OR veiculo_id = $4)
      LIMIT 1`,
      [userId, routeId, route.motoristaId, route.veiculoId],
    );

    if (overlaps.rowCount > 0) {
      throw new HttpError(409, "Motorista ou veiculo ja estao em outra rota em andamento");
    }

    await client.query(
      `UPDATE rotas_operacionais
      SET status = 'em_andamento', atualizado_em = NOW()
      WHERE usuario_id = $1 AND id = $2`,
      [userId, routeId],
    );
    await client.query(
      `UPDATE entregas
      SET status = 'em_rota', atualizado_em = NOW()
      WHERE id IN (
        SELECT entrega_id
        FROM rota_entregas
        WHERE usuario_id = $1 AND rota_id = $2 AND ativo = TRUE
      )`,
      [userId, routeId],
    );
    await client.query(
      `UPDATE veiculos
      SET status = 'em_rota', atualizado_em = NOW()
      WHERE usuario_id = $1 AND id = $2`,
      [userId, route.veiculoId],
    );

    const updated = await findById(userId, routeId, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeRoute(userId, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (route.status !== "em_andamento") {
      throw new HttpError(409, "Somente rotas em andamento podem ser concluidas");
    }

    await client.query(
      `UPDATE rotas_operacionais
      SET status = 'concluida', atualizado_em = NOW()
      WHERE usuario_id = $1 AND id = $2`,
      [userId, routeId],
    );
    await client.query(
      `UPDATE entregas
      SET status = 'entregue', atualizado_em = NOW()
      WHERE id IN (
        SELECT entrega_id
        FROM rota_entregas
        WHERE usuario_id = $1 AND rota_id = $2 AND ativo = TRUE
      )`,
      [userId, routeId],
    );
    await client.query(
      `UPDATE rota_entregas
      SET ativo = FALSE, desvinculado_em = NOW()
      WHERE usuario_id = $1 AND rota_id = $2 AND ativo = TRUE`,
      [userId, routeId],
    );
    await client.query(
      `UPDATE veiculos
      SET status = 'disponivel', atualizado_em = NOW()
      WHERE usuario_id = $1 AND id = $2`,
      [userId, route.veiculoId],
    );

    const updated = await findById(userId, routeId, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelRoute(userId, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, userId, routeId);

    if (!["planejada", "em_andamento"].includes(route.status)) {
      throw new HttpError(409, "Esta rota nao pode mais ser cancelada");
    }

    await client.query(
      `UPDATE rotas_operacionais
      SET status = 'cancelada', atualizado_em = NOW()
      WHERE usuario_id = $1 AND id = $2`,
      [userId, routeId],
    );

    if (route.status === "em_andamento") {
      await client.query(
        `UPDATE entregas
        SET status = 'em_transito', atualizado_em = NOW()
        WHERE id IN (
          SELECT entrega_id
          FROM rota_entregas
          WHERE usuario_id = $1 AND rota_id = $2 AND ativo = TRUE
        )
          AND status = 'em_rota'`,
        [userId, routeId],
      );
      await client.query(
        `UPDATE veiculos
        SET status = 'disponivel', atualizado_em = NOW()
        WHERE usuario_id = $1 AND id = $2`,
        [userId, route.veiculoId],
      );
    }

    await client.query(
      `UPDATE rota_entregas
      SET ativo = FALSE, desvinculado_em = NOW()
      WHERE usuario_id = $1 AND rota_id = $2 AND ativo = TRUE`,
      [userId, routeId],
    );

    const updated = await findById(userId, routeId, client);
    const apoio = await getSupportData(userId, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getDashboardSummary,
  getDashboardSummaryForUser,
  getSupportData,
  getSupportDataForUser,
  listByUserId,
  listForUser,
  findById,
  findByIdForUser,
  create,
  updateById,
  deleteById,
  addDeliveries,
  removeDelivery,
  startRoute,
  completeRoute,
  cancelRoute,
};
