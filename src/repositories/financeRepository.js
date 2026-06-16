const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const fleetCostRepository = require("./fleetCostRepository");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

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

async function findClientById(actor, clientId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "c" });
  const clientIdIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT id, nome, documento, status
    FROM clientes c
    WHERE ${tenant.condition} AND id = $${clientIdIndex}`,
    [...tenant.params, clientId],
  );

  return result.rows[0] || null;
}

async function findClientByName(actor, clientName) {
  const tenant = buildTenantCondition({ actor, tableAlias: "c" });
  const clientNameIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT id, nome, documento, status
    FROM clientes c
    WHERE ${tenant.condition} AND LOWER(nome) = LOWER($${clientNameIndex})
    ORDER BY criado_em ASC
    LIMIT 1`,
    [...tenant.params, clientName],
  );

  return result.rows[0] || null;
}

async function findDeliveryById(actor, deliveryId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "entregas" });
  const deliveryIdIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT
      id,
      cliente_id AS "clienteId",
      codigo,
      cliente,
      status,
      TO_CHAR(previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      valor_frete AS "valorFrete"
    FROM entregas
    WHERE ${tenant.condition} AND id = $${deliveryIdIndex}`,
    [...tenant.params, deliveryId],
  );

  return result.rows[0] || null;
}

async function ensureActiveDeliveryFinancialUniqueness(actor, entregaId, excludedId = null) {
  if (!entregaId) {
    return;
  }

  const tenant = buildTenantCondition({ actor, tableAlias: "lancamentos_financeiros" });
  const values = [...tenant.params, entregaId];
  let query = `SELECT id
    FROM lancamentos_financeiros
    WHERE ${tenant.condition}
      AND entrega_id = $${tenant.nextIndex}
      AND status <> 'cancelado'`;

  if (excludedId) {
    values.push(excludedId);
    query += ` AND id <> $${tenant.nextIndex + 1}`;
  }

  query += " LIMIT 1";

  const result = await database.query(query, values);
  if (result.rowCount > 0) {
    throw new HttpError(409, "Ja existe lancamento financeiro ativo para esta entrega");
  }
}

async function resolveLinkedEntities(actor, payload, options = {}) {
  const { excludedFinancialId = null } = options;
  let client = null;
  let delivery = null;

  if (payload.clienteId) {
    client = await findClientById(actor, payload.clienteId);
    if (!client) {
      throw new HttpError(404, "Cliente nao encontrado");
    }
  }

  if (payload.entregaId) {
    delivery = await findDeliveryById(actor, payload.entregaId);
    if (!delivery) {
      throw new HttpError(404, "Entrega nao encontrada");
    }

    await ensureActiveDeliveryFinancialUniqueness(
      actor,
      payload.entregaId,
      excludedFinancialId,
    );

    if (!client) {
      client = delivery.clienteId
        ? await findClientById(actor, delivery.clienteId)
        : await findClientByName(actor, delivery.cliente);
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
      COALESCE(dc.nome, e.cliente) AS "entregaCliente",
      e.status AS "entregaStatus",
      e.valor_frete AS "entregaValorFrete",
      lf.criado_em AS "criadoEm",
      lf.atualizado_em AS "atualizadoEm"
    FROM lancamentos_financeiros lf
    LEFT JOIN clientes c ON c.id = lf.cliente_id
    LEFT JOIN entregas e ON e.id = lf.entrega_id
    LEFT JOIN clientes dc ON dc.id = e.cliente_id`;
}

function isWithinRange(value, start, end) {
  if (!value || !start || !end) {
    return false;
  }

  return value >= start && value <= end;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDateText, days) {
  const date = new Date(`${baseDateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function buildDateSeries(start, end) {
  if (!start || !end) {
    return [];
  }

  const series = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor <= last) {
    series.push(formatDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function buildReceivableItem(entry) {
  return {
    ...entry,
    origem: "financeiro",
    dataReferencia: entry.dataVencimento || entry.dataCompetencia || null,
  };
}

function buildPayableItemFromFinance(entry) {
  return {
    id: entry.id,
    origem: "financeiro",
    tipoOrigem: entry.tipo,
    descricao: entry.descricao,
    valor: entry.valor,
    status: entry.status,
    dataCompetencia: entry.dataCompetencia,
    dataVencimento: entry.dataVencimento,
    dataPagamento: entry.dataPagamento,
    observacoes: entry.observacoes,
    cliente: entry.cliente,
    entrega: entry.entrega,
    dataReferencia: entry.dataVencimento || entry.dataCompetencia || null,
  };
}

function buildPayableItemFromFleet(expense) {
  return {
    id: expense.id,
    origem: "frota",
    tipoOrigem: expense.tipo,
    descricao: expense.descricao,
    valor: expense.valor,
    status: expense.status,
    dataCompetencia: expense.dataDespesa,
    dataVencimento: expense.dataVencimento,
    dataPagamento: expense.dataPagamento,
    observacoes: expense.observacoes,
    veiculo: expense.veiculo,
    motorista: expense.motorista,
    dataReferencia: expense.dataVencimento || expense.dataDespesa || null,
  };
}

async function listByUserId(actor, filters = {}) {
  const tenant = buildTenantCondition({ actor, tableAlias: "lf" });
  const conditions = [tenant.condition];
  const values = [...tenant.params];

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

async function findById(actor, financialId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "lf" });
  const financialIdIndex = tenant.nextIndex;
  const result = await database.query(
    `${buildSelectQuery()}
    WHERE ${tenant.condition} AND lf.id = $${financialIdIndex}`,
    [...tenant.params, financialId],
  );

  return mapFinancialEntry(result.rows[0]);
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const { client, delivery } = await resolveLinkedEntities(actor, payload);
  const status = payload.status || "pendente";
  const dataPagamento =
    status === "pago"
      ? payload.dataPagamento || new Date().toISOString().slice(0, 10)
      : payload.dataPagamento || null;

  const result = await database.query(
    `INSERT INTO lancamentos_financeiros (
      usuario_id,
      empresa_id,
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      context.userId,
      context.empresaId,
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

  return findById(actor, result.rows[0].id);
}

async function updateById(actor, financialId, payload) {
  const tenant = buildTenantCondition({ actor, tableAlias: "lancamentos_financeiros", startIndex: 2 });
  const current = await findById(actor, financialId);
  if (!current) {
    return null;
  }

  const mergedPayload = {
    clienteId: Object.hasOwn(payload, "clienteId") ? payload.clienteId : current.clienteId,
    entregaId: Object.hasOwn(payload, "entregaId") ? payload.entregaId : current.entregaId,
  };
  const { client } = await resolveLinkedEntities(actor, mergedPayload, {
    excludedFinancialId: financialId,
  });

  const fields = [];
  const values = [financialId, ...tenant.params];
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
    WHERE id = $1 AND ${tenant.condition}`,
    values,
  );

  return findById(actor, financialId);
}

async function updateStatusById(actor, financialId, status, dataPagamento = null) {
  const tenant = buildTenantCondition({ actor, tableAlias: "lancamentos_financeiros", startIndex: 3 });
  const values = [financialId, status, ...tenant.params];
  const fields = ["status = $3", "atualizado_em = NOW()"];

  if (status === "pago") {
    values[1] = status;
    fields[0] = "status = $2";
    values.push(dataPagamento || new Date().toISOString().slice(0, 10));
    fields.push(`data_pagamento = $${values.length}`);
  } else {
    fields[0] = "status = $2";
    fields.push("data_pagamento = NULL");
  }

  const result = await database.query(
    `UPDATE lancamentos_financeiros
    SET ${fields.join(", ")}
    WHERE id = $1 AND ${tenant.condition}
    RETURNING id`,
    values,
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findById(actor, financialId);
}

async function cancelById(actor, financialId) {
  return updateStatusById(actor, financialId, "cancelado");
}

async function cancelPendingByDeliveryId(actor, deliveryId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "lancamentos_financeiros", startIndex: 2 });
  const result = await database.query(
    `UPDATE lancamentos_financeiros
    SET status = 'cancelado',
        data_pagamento = NULL,
        atualizado_em = NOW()
    WHERE entrega_id = $1
      AND ${tenant.condition}
      AND status = 'pendente'
    RETURNING id`,
    [deliveryId, ...tenant.params],
  );

  return result.rows;
}

async function createFromDelivery(actor, deliveryId, payload = {}) {
  const delivery = await findDeliveryById(actor, deliveryId);
  if (!delivery) {
    throw new HttpError(404, "Entrega nao encontrada");
  }

  if (delivery.status !== "entregue") {
    throw new HttpError(409, "A entrega precisa estar concluida para gerar lancamento");
  }

  await ensureActiveDeliveryFinancialUniqueness(actor, deliveryId);

  const linkedClient = payload.clienteId
    ? await findClientById(actor, payload.clienteId)
    : delivery.clienteId
      ? await findClientById(actor, delivery.clienteId)
      : await findClientByName(actor, delivery.cliente);

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

  const context = normalizeActor(actor);
  const result = await database.query(
    `INSERT INTO lancamentos_financeiros (
      usuario_id,
      empresa_id,
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente', $8, $9, NULL, $10)
    RETURNING id`,
    [
      context.userId,
      context.empresaId,
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

  return findById(actor, result.rows[0].id);
}

async function listSupportData(actor) {
  const clientTenant = buildTenantCondition({ actor, tableAlias: "clientes" });
  const deliveryTenant = buildTenantCondition({ actor, tableAlias: "e" });
  const financialTenant = buildTenantCondition({
    actor,
    tableAlias: "lf",
    startIndex: deliveryTenant.params.length + 1,
  });
  const [clientsResult, deliveriesResult] = await Promise.all([
    database.query(
      `SELECT id, nome, documento, status
      FROM clientes
      WHERE ${clientTenant.condition}
      ORDER BY nome ASC`,
      clientTenant.params,
    ),
    database.query(
      `SELECT
        e.id,
        e.cliente_id AS "clienteId",
        e.codigo,
        e.cliente,
        e.status,
        TO_CHAR(e.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
        e.valor_frete AS "valorFrete",
        EXISTS (
          SELECT 1
          FROM lancamentos_financeiros lf
          WHERE lf.entrega_id = e.id
            AND ${financialTenant.condition}
            AND lf.status <> 'cancelado'
        ) AS "temLancamentoAtivo"
      FROM entregas e
      WHERE ${deliveryTenant.condition}
      ORDER BY e.previsao_entrega DESC NULLS LAST, e.codigo ASC`,
      [...deliveryTenant.params, ...financialTenant.params],
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
      clienteId: row.clienteId || null,
      codigo: row.codigo,
      cliente: row.cliente,
      status: row.status,
      dataPrevista: row.dataPrevista,
      valorFrete: row.valorFrete != null ? Number(row.valorFrete) : null,
      temLancamentoAtivo: row.temLancamentoAtivo,
    })),
  };
}

async function getCashFlowData(actor, filters) {
  const [financialEntries, vehicleExpenses] = await Promise.all([
    listByUserId(actor),
    fleetCostRepository.listByUserId(actor, { ativo: true }),
  ]);

  const receivables = financialEntries
    .filter((entry) => entry.tipo === "receita" && entry.status !== "cancelado")
    .map(buildReceivableItem);
  const payableFinanceEntries = financialEntries
    .filter((entry) => ["despesa", "repasse"].includes(entry.tipo) && entry.status !== "cancelado")
    .map(buildPayableItemFromFinance);
  const payableFleetEntries = vehicleExpenses
    .filter((expense) => !expense.integrarFinanceiro)
    .map(buildPayableItemFromFleet);
  const payables = [...payableFinanceEntries, ...payableFleetEntries];

  const openReceivables = receivables.filter((item) => ["pendente", "faturado"].includes(item.status));
  const paidReceivables = receivables.filter((item) => item.status === "pago");
  const openPayables = payables.filter((item) => ["pendente", "faturado"].includes(item.status));
  const paidPayables = payables.filter((item) => item.status === "pago");

  const receivablesInRange = receivables.filter((item) =>
    isWithinRange(item.dataReferencia, filters.dataInicio, filters.dataFim),
  );
  const payablesInRange = payables.filter((item) =>
    isWithinRange(item.dataReferencia, filters.dataInicio, filters.dataFim),
  );

  const totalReceber = roundCurrency(
    openReceivables
      .filter((item) => isWithinRange(item.dataReferencia, filters.dataInicio, filters.dataFim))
      .reduce((sum, item) => sum + item.valor, 0),
  );
  const totalPagar = roundCurrency(
    openPayables
      .filter((item) => isWithinRange(item.dataReferencia, filters.dataInicio, filters.dataFim))
      .reduce((sum, item) => sum + item.valor, 0),
  );
  const receitasPrevistas = totalReceber;
  const receitasRecebidas = roundCurrency(
    paidReceivables
      .filter((item) => isWithinRange(item.dataPagamento, filters.dataInicio, filters.dataFim))
      .reduce((sum, item) => sum + item.valor, 0),
  );
  const despesasPrevistas = totalPagar;
  const despesasPagas = roundCurrency(
    paidPayables
      .filter((item) => isWithinRange(item.dataPagamento, filters.dataInicio, filters.dataFim))
      .reduce((sum, item) => sum + item.valor, 0),
  );

  const saldoAtual = roundCurrency(
    paidReceivables
      .filter((item) => item.dataPagamento && item.dataPagamento <= filters.hoje)
      .reduce((sum, item) => sum + item.valor, 0) -
      paidPayables
        .filter((item) => item.dataPagamento && item.dataPagamento <= filters.hoje)
        .reduce((sum, item) => sum + item.valor, 0),
  );
  const saldoProjetado = roundCurrency(saldoAtual + receitasPrevistas - despesasPrevistas);
  const proximoLimite = addDays(filters.hoje, 7);

  const contasReceber = {
    itens: receivablesInRange.sort((left, right) =>
      String(left.dataReferencia || "").localeCompare(String(right.dataReferencia || "")),
    ),
    resumo: {
      totalReceber,
      vencidos: roundCurrency(
        openReceivables
          .filter((item) => item.dataReferencia && item.dataReferencia < filters.hoje)
          .reduce((sum, item) => sum + item.valor, 0),
      ),
      proximosVencimentos: roundCurrency(
        openReceivables
          .filter(
            (item) =>
              item.dataReferencia &&
              item.dataReferencia >= filters.hoje &&
              item.dataReferencia <= proximoLimite,
          )
          .reduce((sum, item) => sum + item.valor, 0),
      ),
      recebidos: receitasRecebidas,
    },
  };

  const contasPagar = {
    itens: payablesInRange.sort((left, right) =>
      String(left.dataReferencia || "").localeCompare(String(right.dataReferencia || "")),
    ),
    resumo: {
      totalPagar,
      vencidos: roundCurrency(
        openPayables
          .filter((item) => item.dataReferencia && item.dataReferencia < filters.hoje)
          .reduce((sum, item) => sum + item.valor, 0),
      ),
      proximosVencimentos: roundCurrency(
        openPayables
          .filter(
            (item) =>
              item.dataReferencia &&
              item.dataReferencia >= filters.hoje &&
              item.dataReferencia <= proximoLimite,
          )
          .reduce((sum, item) => sum + item.valor, 0),
      ),
      pagos: despesasPagas,
    },
  };

  const currentMonthStart = `${filters.hoje.slice(0, 8)}01`;
  const currentMonthEnd = (() => {
    const base = new Date(`${currentMonthStart}T00:00:00Z`);
    return formatDate(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)));
  })();
  const faturamentoMes = roundCurrency(
    paidReceivables
      .filter((item) => isWithinRange(item.dataPagamento, currentMonthStart, currentMonthEnd))
      .reduce((sum, item) => sum + item.valor, 0),
  );
  const despesasMes = roundCurrency(
    paidPayables
      .filter((item) => isWithinRange(item.dataPagamento, currentMonthStart, currentMonthEnd))
      .reduce((sum, item) => sum + item.valor, 0),
  );
  const lucroLiquidoMes = roundCurrency(faturamentoMes - despesasMes);
  const margemOperacionalMes =
    faturamentoMes === 0 ? 0 : roundCurrency((lucroLiquidoMes / faturamentoMes) * 100);
  const contasVencidas = openReceivables.filter(
    (item) => item.dataReferencia && item.dataReferencia < filters.hoje,
  ).length +
    openPayables.filter((item) => item.dataReferencia && item.dataReferencia < filters.hoje).length;

  const dateSeries = buildDateSeries(filters.dataInicio, filters.dataFim);
  const movementByDate = new Map(
    dateSeries.map((date) => [
      date,
      { data: date, receita: 0, despesa: 0, lucro: 0, fluxoAcumulado: 0 },
    ]),
  );

  for (const item of paidReceivables) {
    if (movementByDate.has(item.dataPagamento)) {
      movementByDate.get(item.dataPagamento).receita += item.valor;
    }
  }

  for (const item of paidPayables) {
    if (movementByDate.has(item.dataPagamento)) {
      movementByDate.get(item.dataPagamento).despesa += item.valor;
    }
  }

  const saldoAnterior = roundCurrency(
    paidReceivables
      .filter((item) => item.dataPagamento && item.dataPagamento < filters.dataInicio)
      .reduce((sum, item) => sum + item.valor, 0) -
      paidPayables
        .filter((item) => item.dataPagamento && item.dataPagamento < filters.dataInicio)
        .reduce((sum, item) => sum + item.valor, 0),
  );
  let acumulado = saldoAnterior;
  const fluxoAcumulado = [...movementByDate.values()].map((item) => {
    const receita = roundCurrency(item.receita);
    const despesa = roundCurrency(item.despesa);
    const lucro = roundCurrency(receita - despesa);
    acumulado = roundCurrency(acumulado + lucro);
    return {
      ...item,
      receita,
      despesa,
      lucro,
      fluxoAcumulado: acumulado,
    };
  });

  const totalReceitaPeriodo = roundCurrency(receivablesInRange.reduce((sum, item) => sum + item.valor, 0));
  const totalDespesaPeriodo = roundCurrency(payablesInRange.reduce((sum, item) => sum + item.valor, 0));
  const uniqueClientIds = new Set(receivablesInRange.map((item) => item.clienteId).filter(Boolean));
  const uniqueDeliveryIds = new Set(receivablesInRange.map((item) => item.entregaId).filter(Boolean));
  const uniqueVehicleIds = new Set(
    payables.filter((item) => item.origem === "frota" && item.veiculo?.id).map((item) => item.veiculo.id),
  );
  const ticketMedioPorCliente =
    uniqueClientIds.size === 0 ? 0 : roundCurrency(totalReceitaPeriodo / uniqueClientIds.size);
  const receitaPorEntrega =
    uniqueDeliveryIds.size === 0 ? 0 : roundCurrency(totalReceitaPeriodo / uniqueDeliveryIds.size);
  const custoPorEntrega =
    uniqueDeliveryIds.size === 0 ? 0 : roundCurrency(totalDespesaPeriodo / uniqueDeliveryIds.size);
  const lucroPorEntrega =
    uniqueDeliveryIds.size === 0
      ? 0
      : roundCurrency((totalReceitaPeriodo - totalDespesaPeriodo) / uniqueDeliveryIds.size);
  const receitaPorVeiculo =
    uniqueVehicleIds.size === 0 ? 0 : roundCurrency(totalReceitaPeriodo / uniqueVehicleIds.size);
  const custoPorVeiculo =
    uniqueVehicleIds.size === 0 ? 0 : roundCurrency(totalDespesaPeriodo / uniqueVehicleIds.size);
  const lucroPorVeiculo =
    uniqueVehicleIds.size === 0
      ? 0
      : roundCurrency((totalReceitaPeriodo - totalDespesaPeriodo) / uniqueVehicleIds.size);

  return {
    filtros: filters,
    fluxoCaixa: {
      saldoAtual,
      receitasPrevistas,
      receitasRecebidas,
      despesasPrevistas,
      despesasPagas,
      saldoProjetado,
    },
    contasReceber,
    contasPagar,
    dashboardFinanceiro: {
      faturamentoMes,
      despesasMes,
      lucroLiquido: lucroLiquidoMes,
      margemOperacional: margemOperacionalMes,
      saldoProjetado,
      contasVencidas,
      fluxoCaixaAcumulado: fluxoAcumulado.at(-1)?.fluxoAcumulado || saldoAnterior,
    },
    graficos: {
      receitaPorPeriodo: fluxoAcumulado.map((item) => ({ data: item.data, valor: item.receita })),
      despesaPorPeriodo: fluxoAcumulado.map((item) => ({ data: item.data, valor: item.despesa })),
      lucroPorPeriodo: fluxoAcumulado.map((item) => ({ data: item.data, valor: item.lucro })),
      fluxoAcumulado: fluxoAcumulado.map((item) => ({
        data: item.data,
        valor: item.fluxoAcumulado,
      })),
    },
    indicadoresEstrategicos: {
      ticketMedioPorCliente,
      receitaPorEntrega,
      custoPorEntrega,
      lucroPorEntrega,
      receitaPorVeiculo,
      custoPorVeiculo,
      lucroPorVeiculo,
    },
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
  getCashFlowData,
};
