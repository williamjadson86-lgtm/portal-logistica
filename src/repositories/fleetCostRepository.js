const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

function mapVehicleExpense(row) {
  if (!row) {
    return null;
  }

  const derivedStatus =
    row.ativo === false
      ? "cancelado"
      : row.expenseStatus || (row.dataPagamento ? "pago" : "pendente");

  return {
    id: row.id,
    usuarioId: row.usuarioId,
    empresaId: row.empresaId,
    veiculoId: row.veiculoId,
    motoristaId: row.motoristaId,
    lancamentoFinanceiroId: row.lancamentoFinanceiroId,
    integrarFinanceiro: Boolean(row.lancamentoFinanceiroId),
    tipo: row.tipo,
    descricao: row.descricao,
    valor: Number(row.valor || 0),
    status: derivedStatus,
    dataDespesa: row.dataDespesa,
    dataVencimento: row.dataVencimento,
    dataPagamento: row.dataPagamento,
    observacoes: row.observacoes || "",
    ativo: row.ativo,
    veiculo: row.veiculoId
      ? {
          id: row.veiculoId,
          placa: row.veiculoPlaca,
          modelo: row.veiculoModelo,
          status: row.veiculoStatus,
        }
      : null,
    motorista: row.motoristaId
      ? {
          id: row.motoristaId,
          nome: row.motoristaNome,
          status: row.motoristaStatus,
        }
      : null,
    financeiro: row.lancamentoFinanceiroId
      ? {
          id: row.lancamentoFinanceiroId,
          status: row.financialStatus || derivedStatus,
          dataCompetencia: row.dataDespesa,
          dataVencimento: row.dataVencimento,
          dataPagamento: row.dataPagamento,
        }
      : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function buildSelectQuery() {
  return `SELECT
      dv.id,
      dv.usuario_id AS "usuarioId",
      dv.empresa_id AS "empresaId",
      dv.veiculo_id AS "veiculoId",
      dv.motorista_id AS "motoristaId",
      dv.lancamento_financeiro_id AS "lancamentoFinanceiroId",
      dv.tipo,
      dv.descricao,
      dv.valor,
      dv.status AS "expenseStatus",
      lf.status AS "financialStatus",
      TO_CHAR(dv.data_despesa, 'YYYY-MM-DD') AS "dataDespesa",
      TO_CHAR(dv.data_vencimento, 'YYYY-MM-DD') AS "dataVencimento",
      TO_CHAR(dv.data_pagamento, 'YYYY-MM-DD') AS "dataPagamento",
      dv.observacoes,
      dv.ativo,
      v.placa AS "veiculoPlaca",
      v.modelo AS "veiculoModelo",
      v.status AS "veiculoStatus",
      m.nome AS "motoristaNome",
      m.status AS "motoristaStatus",
      dv.criado_em AS "criadoEm",
      dv.atualizado_em AS "atualizadoEm"
    FROM despesas_veiculos dv
    INNER JOIN veiculos v ON v.id = dv.veiculo_id
    LEFT JOIN motoristas m ON m.id = dv.motorista_id
    LEFT JOIN lancamentos_financeiros lf ON lf.id = dv.lancamento_financeiro_id`;
}

async function createFinancialEntry(client, context, payload) {
  const status = payload.status === "pago" ? "pago" : "pendente";
  const dataPagamento =
    status === "pago"
      ? payload.dataPagamento || new Date().toISOString().slice(0, 10)
      : payload.dataPagamento || null;
  const result = await client.query(
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
    VALUES ($1, $2, NULL, NULL, 'despesa', $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [
      context.userId,
      context.empresaId,
      payload.descricao,
      payload.valor,
      status,
      payload.dataDespesa,
      payload.dataVencimento || null,
      dataPagamento,
      payload.observacoes || null,
    ],
  );

  return {
    id: result.rows[0].id,
    status,
    dataPagamento,
  };
}

async function ensureVehicleExists(client, actor, veiculoId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "v" });
  const veiculoIdIndex = tenant.nextIndex;
  const result = await client.query(
    `SELECT id, placa, modelo, status
    FROM veiculos v
    WHERE ${tenant.condition} AND id = $${veiculoIdIndex}`,
    [...tenant.params, veiculoId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Veiculo nao encontrado");
  }

  return result.rows[0];
}

async function ensureDriverExists(client, actor, motoristaId) {
  if (!motoristaId) {
    return null;
  }

  const tenant = buildTenantCondition({ actor, tableAlias: "m" });
  const motoristaIdIndex = tenant.nextIndex;
  const result = await client.query(
    `SELECT id, nome, status
    FROM motoristas m
    WHERE ${tenant.condition} AND id = $${motoristaIdIndex}`,
    [...tenant.params, motoristaId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Motorista nao encontrado");
  }

  return result.rows[0];
}

async function listByUserId(actor, filters = {}) {
  const tenant = buildTenantCondition({ actor, tableAlias: "dv" });
  const conditions = [tenant.condition];
  const values = [...tenant.params];

  if (!Object.hasOwn(filters, "ativo") || filters.ativo !== false) {
    conditions.push("dv.ativo = TRUE");
  }

  if (filters.veiculoId) {
    values.push(filters.veiculoId);
    conditions.push(`dv.veiculo_id = $${values.length}`);
  }

  if (filters.motoristaId) {
    values.push(filters.motoristaId);
    conditions.push(`dv.motorista_id = $${values.length}`);
  }

  if (filters.tipo) {
    values.push(filters.tipo);
    conditions.push(`dv.tipo = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`dv.status = $${values.length}`);
  }

  if (filters.dataInicio) {
    values.push(filters.dataInicio);
    conditions.push(`dv.data_despesa >= $${values.length}::date`);
  }

  if (filters.dataFim) {
    values.push(filters.dataFim);
    conditions.push(`dv.data_despesa <= $${values.length}::date`);
  }

  const result = await database.query(
    `${buildSelectQuery()}
    WHERE ${conditions.join(" AND ")}
    ORDER BY dv.data_despesa DESC, dv.criado_em DESC`,
    values,
  );

  return result.rows.map(mapVehicleExpense);
}

async function findById(actor, expenseId, client = database) {
  const tenant = buildTenantCondition({ actor, tableAlias: "dv" });
  const expenseIdIndex = tenant.nextIndex;
  const result = await client.query(
    `${buildSelectQuery()}
    WHERE ${tenant.condition} AND dv.id = $${expenseIdIndex}`,
    [...tenant.params, expenseId],
  );

  return mapVehicleExpense(result.rows[0]);
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    await ensureVehicleExists(client, actor, payload.veiculoId);
    await ensureDriverExists(client, actor, payload.motoristaId || null);

    const shouldIntegrate = payload.integrarFinanceiro !== false;
    const status = payload.status || "pendente";
    const dataPagamento =
      status === "pago"
        ? payload.dataPagamento || new Date().toISOString().slice(0, 10)
        : payload.dataPagamento || null;
    const financialEntry = shouldIntegrate
      ? await createFinancialEntry(client, context, payload)
      : null;

    const result = await client.query(
      `INSERT INTO despesas_veiculos (
        usuario_id,
        empresa_id,
        veiculo_id,
        motorista_id,
        lancamento_financeiro_id,
        tipo,
        descricao,
        valor,
        status,
        data_despesa,
        data_vencimento,
        data_pagamento,
        observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        context.userId,
        context.empresaId,
        payload.veiculoId,
        payload.motoristaId || null,
        financialEntry?.id || null,
        payload.tipo,
        payload.descricao,
        payload.valor,
        status,
        payload.dataDespesa,
        payload.dataVencimento || null,
        dataPagamento,
        payload.observacoes || null,
      ],
    );

    await client.query("COMMIT");
    return findById(actor, result.rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateById(actor, expenseId, payload) {
  const current = await findById(actor, expenseId);
  if (!current) {
    return null;
  }

  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const merged = {
      veiculoId: Object.hasOwn(payload, "veiculoId") ? payload.veiculoId : current.veiculoId,
      motoristaId: Object.hasOwn(payload, "motoristaId") ? payload.motoristaId : current.motoristaId,
      tipo: Object.hasOwn(payload, "tipo") ? payload.tipo : current.tipo,
      descricao: Object.hasOwn(payload, "descricao") ? payload.descricao : current.descricao,
      valor: Object.hasOwn(payload, "valor") ? payload.valor : current.valor,
      status: Object.hasOwn(payload, "status") ? payload.status : current.status,
      integrarFinanceiro: Object.hasOwn(payload, "integrarFinanceiro")
        ? payload.integrarFinanceiro
        : current.integrarFinanceiro,
      dataDespesa: Object.hasOwn(payload, "dataDespesa") ? payload.dataDespesa : current.dataDespesa,
      dataVencimento: Object.hasOwn(payload, "dataVencimento")
        ? payload.dataVencimento
        : current.dataVencimento,
      dataPagamento: Object.hasOwn(payload, "dataPagamento")
        ? payload.dataPagamento
        : current.dataPagamento,
      observacoes: Object.hasOwn(payload, "observacoes")
        ? payload.observacoes
        : current.observacoes,
    };

    await ensureVehicleExists(client, actor, merged.veiculoId);
    await ensureDriverExists(client, actor, merged.motoristaId || null);

    if (current.lancamentoFinanceiroId && merged.integrarFinanceiro === false) {
      throw new HttpError(
        409,
        "Despesa ja vinculada ao financeiro. Cancele o lancamento financeiro separadamente se necessario",
      );
    }

    const effectivePayment =
      merged.status === "pago"
        ? merged.dataPagamento || new Date().toISOString().slice(0, 10)
        : null;
    const context = normalizeActor(actor);
    let linkedFinancialId = current.lancamentoFinanceiroId;

    if (!linkedFinancialId && merged.integrarFinanceiro) {
      const createdFinancial = await createFinancialEntry(client, context, {
        descricao: merged.descricao,
        valor: merged.valor,
        status: merged.status,
        dataDespesa: merged.dataDespesa,
        dataVencimento: merged.dataVencimento,
        dataPagamento: effectivePayment,
        observacoes: merged.observacoes,
      });
      linkedFinancialId = createdFinancial.id;
    }

    const expenseTenant = buildTenantCondition({
      actor,
      tableAlias: "despesas_veiculos",
      startIndex: 2,
    });
    await client.query(
      `UPDATE despesas_veiculos
      SET veiculo_id = $${expenseTenant.nextIndex},
          motorista_id = $${expenseTenant.nextIndex + 1},
          tipo = $${expenseTenant.nextIndex + 2},
          descricao = $${expenseTenant.nextIndex + 3},
          valor = $${expenseTenant.nextIndex + 4},
          status = $${expenseTenant.nextIndex + 5},
          lancamento_financeiro_id = $${expenseTenant.nextIndex + 6},
          data_despesa = $${expenseTenant.nextIndex + 7},
          data_vencimento = $${expenseTenant.nextIndex + 8},
          data_pagamento = $${expenseTenant.nextIndex + 9},
          observacoes = $${expenseTenant.nextIndex + 10},
          atualizado_em = NOW()
      WHERE id = $1 AND ${expenseTenant.condition}`,
      [
        expenseId,
        ...expenseTenant.params,
        merged.veiculoId,
        merged.motoristaId || null,
        merged.tipo,
        merged.descricao,
        merged.valor,
        merged.status,
        linkedFinancialId,
        merged.dataDespesa,
        merged.dataVencimento || null,
        effectivePayment,
        merged.observacoes || null,
      ],
    );

    if (linkedFinancialId) {
      await client.query(
        `UPDATE lancamentos_financeiros
        SET descricao = $2,
            valor = $3,
            status = $4,
            data_competencia = $5,
            data_vencimento = $6,
            data_pagamento = $7,
            observacoes = $8,
            atualizado_em = NOW()
        WHERE id = $1`,
        [
          linkedFinancialId,
          merged.descricao,
          merged.valor,
          merged.status,
          merged.dataDespesa,
          merged.dataVencimento || null,
          effectivePayment,
          merged.observacoes || null,
        ],
      );
    }

    await client.query("COMMIT");
    return findById(actor, expenseId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteById(actor, expenseId) {
  const current = await findById(actor, expenseId);
  if (!current) {
    return null;
  }

  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const tenant = buildTenantCondition({ actor, tableAlias: "despesas_veiculos", startIndex: 2 });
    await client.query(
      `UPDATE despesas_veiculos
      SET ativo = FALSE, status = 'cancelado', atualizado_em = NOW()
      WHERE id = $1 AND ${tenant.condition}`,
      [expenseId, ...tenant.params],
    );
    if (current.lancamentoFinanceiroId) {
      await client.query(
        `UPDATE lancamentos_financeiros
        SET status = 'cancelado',
            data_pagamento = NULL,
            atualizado_em = NOW()
        WHERE id = $1`,
        [current.lancamentoFinanceiroId],
      );
    }
    await client.query("COMMIT");
    return findById(actor, expenseId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateStatusById(actor, expenseId, status, dataPagamento) {
  return updateById(actor, expenseId, { status, dataPagamento });
}

async function listByVehicleId(actor, vehicleId, filters = {}) {
  return listByUserId(actor, { ...filters, veiculoId: vehicleId });
}

async function listSupportData(actor) {
  const vehicleTenant = buildTenantCondition({ actor, tableAlias: "v" });
  const driverTenant = buildTenantCondition({ actor, tableAlias: "m" });
  const [vehiclesResult, driversResult] = await Promise.all([
    database.query(
      `SELECT id, placa, modelo, status
      FROM veiculos v
      WHERE ${vehicleTenant.condition}
      ORDER BY placa ASC`,
      vehicleTenant.params,
    ),
    database.query(
      `SELECT id, nome, status
      FROM motoristas m
      WHERE ${driverTenant.condition}
      ORDER BY nome ASC`,
      driverTenant.params,
    ),
  ]);

  return {
    veiculos: vehiclesResult.rows.map((row) => ({
      id: row.id,
      placa: row.placa,
      modelo: row.modelo,
      status: row.status,
    })),
    motoristas: driversResult.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      status: row.status,
    })),
  };
}

module.exports = {
  listByUserId,
  listByVehicleId,
  findById,
  create,
  updateById,
  updateStatusById,
  deleteById,
  listSupportData,
};
