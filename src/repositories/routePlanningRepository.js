const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const { USER_ROLES } = require("../config/permissions");
const { findLinkedDriverId } = require("./driverAccessRepository");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

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

async function getSupportData(actor, client = database) {
  const routeTenant = buildTenantCondition({ actor, tableAlias: "d" });
  const driverTenant = buildTenantCondition({ actor, tableAlias: "motoristas" });
  const vehicleTenant = buildTenantCondition({ actor, tableAlias: "veiculos" });
  const [driversResult, vehiclesResult, deliveriesResult] = await Promise.all([
    client.query(
      `SELECT id, nome
      FROM motoristas
      WHERE ${driverTenant.condition} AND status = 'ativo'
      ORDER BY nome ASC`,
      driverTenant.params,
    ),
    client.query(
      `SELECT id, placa, modelo
      FROM veiculos
      WHERE ${vehicleTenant.condition} AND status = 'disponivel'
      ORDER BY placa ASC`,
      vehicleTenant.params,
    ),
    client.query(
      `SELECT
        d.id,
        d.codigo,
        d.cliente,
        d.status,
        TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista"
      FROM entregas d
      WHERE ${routeTenant.condition}
        AND d.status = ANY($2::text[])
        AND NOT EXISTS (
          SELECT 1
          FROM rota_entregas re
          WHERE re.entrega_id = d.id
            AND re.ativo = TRUE
        )
      ORDER BY d.previsao_entrega ASC NULLS LAST, d.codigo ASC`,
      [...routeTenant.params, ELIGIBLE_DELIVERY_STATUSES],
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

async function getDashboardSummary(actor) {
  const tenant = buildTenantCondition({ actor });
  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'planejada')::int AS planejadas,
      COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS "emAndamento",
      COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas
    FROM rotas_operacionais
    WHERE ${tenant.condition}`,
    tenant.params,
  );

  return result.rows[0];
}

async function getDashboardSummaryForUser(user) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return getDashboardSummary(user);
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

  const tenant = buildTenantCondition({ actor: user });
  const driverIdIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'planejada')::int AS planejadas,
      COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS "emAndamento",
      COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas
    FROM rotas_operacionais
    WHERE ${tenant.condition}
      AND motorista_id = $${driverIdIndex}`,
    [...tenant.params, driverId],
  );

  return result.rows[0];
}

async function listByUserId(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "r" });
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
    WHERE ${tenant.condition}
    GROUP BY r.id, m.nome, v.placa
    ORDER BY r.data_rota DESC, r.criado_em DESC`,
    tenant.params,
  );

  return result.rows.map(mapRoute);
}

async function listForUser(user) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return listByUserId(user);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return [];
  }

  const tenant = buildTenantCondition({ actor: user, tableAlias: "r" });
  const driverIdIndex = tenant.nextIndex;
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
    WHERE ${tenant.condition}
      AND r.motorista_id = $${driverIdIndex}
    GROUP BY r.id, m.nome, v.placa
    ORDER BY r.data_rota DESC, r.criado_em DESC`,
    [...tenant.params, driverId],
  );

  return result.rows.map(mapRoute);
}

async function findById(actor, routeId, client = database) {
  const tenant = buildTenantCondition({ actor, tableAlias: "r" });
  const routeIdIndex = tenant.nextIndex;
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
    WHERE ${tenant.condition} AND r.id = $${routeIdIndex}
    GROUP BY r.id, m.nome, v.placa`,
    [...tenant.params, routeId],
  );

  const route = mapRoute(routeResult.rows[0]);
  if (!route) {
    return null;
  }

  const relationTenant = buildTenantCondition({ actor, tableAlias: "re" });
  const relationRouteIdIndex = relationTenant.nextIndex;
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
    WHERE ${relationTenant.condition} AND re.rota_id = $${relationRouteIdIndex}
    ORDER BY re.ativo DESC, re.vinculado_em DESC`,
    [...relationTenant.params, routeId],
  );

  return {
    ...route,
    entregas: deliveriesResult.rows.map(mapLinkedDelivery),
  };
}

async function findByIdForUser(user, routeId, client = database) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return findById(user, routeId, client);
  }

  const driverId = await findLinkedDriverId(user);
  if (!driverId) {
    return null;
  }

  const tenant = buildTenantCondition({ actor: user, tableAlias: "r" });
  const routeIdIndex = tenant.nextIndex;
  const driverIdIndex = tenant.nextIndex + 1;
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
    WHERE ${tenant.condition}
      AND r.id = $${routeIdIndex}
      AND r.motorista_id = $${driverIdIndex}
    GROUP BY r.id, m.nome, v.placa`,
    [...tenant.params, routeId, driverId],
  );

  const route = mapRoute(routeResult.rows[0]);
  if (!route) {
    return null;
  }

  const relationTenant = buildTenantCondition({ actor: user, tableAlias: "re" });
  const relationRouteIdIndex = relationTenant.nextIndex;
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
    WHERE ${relationTenant.condition}
      AND re.rota_id = $${relationRouteIdIndex}
    ORDER BY re.ativo DESC, re.vinculado_em DESC`,
    [...relationTenant.params, routeId],
  );

  return {
    ...route,
    entregas: deliveriesResult.rows.map(mapLinkedDelivery),
  };
}

async function getSupportDataForUser(user, client = database) {
  if (user?.tipoUsuario !== USER_ROLES.MOTORISTA) {
    return getSupportData(user, client);
  }

  return {
    motoristas: [],
    veiculos: [],
    entregasDisponiveis: [],
  };
}

async function ensureDriverActive(client, actor, motoristaId) {
  const tenant = buildTenantCondition({ actor, startIndex: 1 });
  const motoristaIdIndex = tenant.nextIndex;
  const result = await client.query(
    `SELECT id
    FROM motoristas
    WHERE ${tenant.condition} AND id = $${motoristaIdIndex} AND status = 'ativo'`,
    [...tenant.params, motoristaId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(400, "Motorista informado nao esta ativo");
  }
}

async function ensureVehicleAvailable(client, actor, veiculoId) {
  const tenant = buildTenantCondition({ actor, startIndex: 1 });
  const vehicleIdIndex = tenant.nextIndex;
  const result = await client.query(
    `SELECT id
    FROM veiculos
    WHERE ${tenant.condition} AND id = $${vehicleIdIndex} AND status = 'disponivel'`,
    [...tenant.params, veiculoId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(400, "Veiculo informado nao esta disponivel");
  }
}

async function ensureRouteExistsForUpdate(client, actor, routeId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "rotas_operacionais", startIndex: 1 });
  const routeIdIndex = tenant.nextIndex;
  const result = await client.query(
    `SELECT id, status, veiculo_id AS "veiculoId", motorista_id AS "motoristaId"
    FROM rotas_operacionais
    WHERE ${tenant.condition} AND id = $${routeIdIndex}
    FOR UPDATE`,
    [...tenant.params, routeId],
  );

  const route = result.rows[0];
  if (!route) {
    throw new HttpError(404, "Rota nao encontrada");
  }

  return route;
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    await ensureDriverActive(client, actor, payload.motoristaId);
    await ensureVehicleAvailable(client, actor, payload.veiculoId);

    const result = await client.query(
      `INSERT INTO rotas_operacionais (
        usuario_id,
        empresa_id,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'planejada', $9, $3, 0)
      RETURNING id`,
      [
        context.userId,
        context.empresaId,
        payload.codigo,
        payload.motoristaId,
        payload.veiculoId,
        payload.origem,
        payload.destino,
        payload.dataRota,
        payload.observacoes,
      ],
    );

    const route = await findById(actor, result.rows[0].id, client);
    const apoio = await getSupportData(actor, client);
    await client.query("COMMIT");
    return { rota: route, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateById(actor, routeId, payload) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Apenas rotas planejadas podem ser editadas");
    }

    if (payload.motoristaId) {
      await ensureDriverActive(client, actor, payload.motoristaId);
    }

    if (payload.veiculoId) {
      await ensureVehicleAvailable(client, actor, payload.veiculoId);
    }

    const fields = [];
    const tenant = buildTenantCondition({ actor, tableAlias: "rotas_operacionais", startIndex: 2 });
    const values = [routeId, ...tenant.params];
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
      WHERE id = $1 AND ${tenant.condition}`,
      values,
    );

    const updated = await findById(actor, routeId, client);
    const apoio = await getSupportData(actor, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteById(actor, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);
    const tenant = buildTenantCondition({ actor, tableAlias: "rota_entregas", startIndex: 2 });

    if (route.status !== "planejada") {
      throw new HttpError(409, "Apenas rotas planejadas podem ser excluidas");
    }

    await client.query(
      `DELETE FROM rota_entregas WHERE rota_id = $1 AND ${tenant.condition}`,
      [routeId, ...tenant.params],
    );
    const routeTenant = buildTenantCondition({
      actor,
      tableAlias: "rotas_operacionais",
      startIndex: 2,
    });
    const result = await client.query(
      `DELETE FROM rotas_operacionais
      WHERE id = $1 AND ${routeTenant.condition}
      RETURNING id`,
      [routeId, ...routeTenant.params],
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

async function addDeliveries(actor, routeId, entregaIds) {
  const context = normalizeActor(actor);
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Somente rotas planejadas aceitam novas entregas");
    }

    const deliveryTenant = buildTenantCondition({ actor, tableAlias: "entregas", startIndex: 1 });
    const entregaIdsIndex = deliveryTenant.nextIndex;
    const deliveriesResult = await client.query(
      `SELECT id, codigo, status
      FROM entregas
      WHERE ${deliveryTenant.condition} AND id = ANY($${entregaIdsIndex}::uuid[])`,
      [...deliveryTenant.params, entregaIds],
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

    const relationDeliveryIdsIndex = context.empresaId ? 2 : 1;
    const activeBindings = await client.query(
      `SELECT d.codigo
      FROM rota_entregas re
      INNER JOIN entregas d ON d.id = re.entrega_id
      WHERE re.entrega_id = ANY($1::uuid[])
        AND re.ativo = TRUE
        ${context.empresaId ? "AND (re.empresa_id = $2 OR (re.empresa_id IS NULL AND d.empresa_id = $2))" : ""}`,
      context.empresaId ? [entregaIds, context.empresaId] : [entregaIds],
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
        [context.userId, routeId, entregaId],
      );
    }

    if (context.empresaId) {
      await client.query(
        `UPDATE rota_entregas
        SET empresa_id = $1
        WHERE rota_id = $2
          AND empresa_id IS NULL`,
        [context.empresaId, routeId],
      );
    }

    const updated = await findById(actor, routeId, client);
    const apoio = await getSupportData(actor, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeDelivery(actor, routeId, entregaId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);
    const tenant = buildTenantCondition({ actor, tableAlias: "rota_entregas", startIndex: 3 });

    if (route.status !== "planejada") {
      throw new HttpError(409, "Somente rotas planejadas permitem remover entregas");
    }

    const result = await client.query(
      `UPDATE rota_entregas
      SET ativo = FALSE, desvinculado_em = NOW()
      WHERE rota_id = $1
        AND entrega_id = $2
        AND ${tenant.condition}
        AND ativo = TRUE
      RETURNING id`,
      [routeId, entregaId, ...tenant.params],
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "Entrega nao esta vinculada a esta rota");
    }

    const updated = await findById(actor, routeId, client);
    const apoio = await getSupportData(actor, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function startRoute(actor, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);

    if (route.status !== "planejada") {
      throw new HttpError(409, "Somente rotas planejadas podem ser iniciadas");
    }

    const relationTenant = buildTenantCondition({ actor, tableAlias: "re", startIndex: 1 });
    const routeIdIndex = relationTenant.nextIndex;
    const deliveriesResult = await client.query(
      `SELECT d.id, d.codigo, d.status
      FROM rota_entregas re
      INNER JOIN entregas d ON d.id = re.entrega_id
      WHERE ${relationTenant.condition} AND re.rota_id = $${routeIdIndex} AND re.ativo = TRUE`,
      [...relationTenant.params, routeId],
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

    await ensureDriverActive(client, actor, route.motoristaId);
    await ensureVehicleAvailable(client, actor, route.veiculoId);

    const routeTenant = buildTenantCondition({ actor, tableAlias: "rotas_operacionais", startIndex: 2 });
    const overlaps = await client.query(
      `SELECT codigo
      FROM rotas_operacionais
      WHERE ${routeTenant.condition}
        AND id <> $1
        AND status = 'em_andamento'
        AND (motorista_id = $${routeTenant.nextIndex} OR veiculo_id = $${routeTenant.nextIndex + 1})
      LIMIT 1`,
      [routeId, ...routeTenant.params, route.motoristaId, route.veiculoId],
    );

    if (overlaps.rowCount > 0) {
      throw new HttpError(409, "Motorista ou veiculo ja estao em outra rota em andamento");
    }

    const routeUpdateTenant = buildTenantCondition({
      actor,
      tableAlias: "rotas_operacionais",
      startIndex: 2,
    });
    await client.query(
      `UPDATE rotas_operacionais
      SET status = 'em_andamento', atualizado_em = NOW()
      WHERE id = $1 AND ${routeUpdateTenant.condition}`,
      [routeId, ...routeUpdateTenant.params],
    );
    const deliveryTenant = buildTenantCondition({ actor, tableAlias: "rota_entregas", startIndex: 2 });
    await client.query(
      `UPDATE entregas
      SET status = 'em_rota', atualizado_em = NOW()
      WHERE id IN (
        SELECT entrega_id
        FROM rota_entregas
        WHERE ${deliveryTenant.condition}
          AND rota_id = $1
          AND ativo = TRUE
      )`,
      [routeId, ...deliveryTenant.params],
    );
    const vehicleTenant = buildTenantCondition({ actor, tableAlias: "veiculos", startIndex: 2 });
    await client.query(
      `UPDATE veiculos
      SET status = 'em_rota', atualizado_em = NOW()
      WHERE id = $1 AND ${vehicleTenant.condition}`,
      [route.veiculoId, ...vehicleTenant.params],
    );

    const updated = await findById(actor, routeId, client);
    const apoio = await getSupportData(actor, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeRoute(actor, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);

    if (route.status !== "em_andamento") {
      throw new HttpError(409, "Somente rotas em andamento podem ser concluidas");
    }

    const routeTenant = buildTenantCondition({
      actor,
      tableAlias: "rotas_operacionais",
      startIndex: 2,
    });
    await client.query(
      `UPDATE rotas_operacionais
      SET status = 'concluida', atualizado_em = NOW()
      WHERE id = $1 AND ${routeTenant.condition}`,
      [routeId, ...routeTenant.params],
    );
    const relationTenant = buildTenantCondition({ actor, tableAlias: "rota_entregas", startIndex: 2 });
    await client.query(
      `UPDATE entregas
      SET status = 'entregue', atualizado_em = NOW()
      WHERE id IN (
        SELECT entrega_id
        FROM rota_entregas
        WHERE ${relationTenant.condition}
          AND rota_id = $1
          AND ativo = TRUE
      )`,
      [routeId, ...relationTenant.params],
    );
    await client.query(
      `UPDATE rota_entregas
      SET ativo = FALSE, desvinculado_em = NOW()
      WHERE rota_id = $1 AND ${relationTenant.condition} AND ativo = TRUE`,
      [routeId, ...relationTenant.params],
    );
    const vehicleTenant = buildTenantCondition({ actor, tableAlias: "veiculos", startIndex: 2 });
    await client.query(
      `UPDATE veiculos
      SET status = 'disponivel', atualizado_em = NOW()
      WHERE id = $1 AND ${vehicleTenant.condition}`,
      [route.veiculoId, ...vehicleTenant.params],
    );

    const updated = await findById(actor, routeId, client);
    const apoio = await getSupportData(actor, client);
    await client.query("COMMIT");
    return { rota: updated, apoio };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelRoute(actor, routeId) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const route = await ensureRouteExistsForUpdate(client, actor, routeId);

    if (!["planejada", "em_andamento"].includes(route.status)) {
      throw new HttpError(409, "Esta rota nao pode mais ser cancelada");
    }

    const routeTenant = buildTenantCondition({
      actor,
      tableAlias: "rotas_operacionais",
      startIndex: 2,
    });
    await client.query(
      `UPDATE rotas_operacionais
      SET status = 'cancelada', atualizado_em = NOW()
      WHERE id = $1 AND ${routeTenant.condition}`,
      [routeId, ...routeTenant.params],
    );

    if (route.status === "em_andamento") {
      const relationTenant = buildTenantCondition({ actor, tableAlias: "rota_entregas", startIndex: 2 });
      await client.query(
        `UPDATE entregas
        SET status = 'em_transito', atualizado_em = NOW()
        WHERE id IN (
          SELECT entrega_id
          FROM rota_entregas
          WHERE ${relationTenant.condition}
            AND rota_id = $1
            AND ativo = TRUE
        )
          AND status = 'em_rota'`,
        [routeId, ...relationTenant.params],
      );
      const vehicleTenant = buildTenantCondition({ actor, tableAlias: "veiculos", startIndex: 2 });
      await client.query(
        `UPDATE veiculos
        SET status = 'disponivel', atualizado_em = NOW()
        WHERE id = $1 AND ${vehicleTenant.condition}`,
        [route.veiculoId, ...vehicleTenant.params],
      );
    }

    const relationTenant = buildTenantCondition({ actor, tableAlias: "rota_entregas", startIndex: 2 });
    await client.query(
      `UPDATE rota_entregas
      SET ativo = FALSE, desvinculado_em = NOW()
      WHERE rota_id = $1 AND ${relationTenant.condition} AND ativo = TRUE`,
      [routeId, ...relationTenant.params],
    );

    const updated = await findById(actor, routeId, client);
    const apoio = await getSupportData(actor, client);
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
