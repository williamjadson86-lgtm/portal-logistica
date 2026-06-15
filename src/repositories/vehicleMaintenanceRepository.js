const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const fleetCostRepository = require("./fleetCostRepository");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

function mapVehicleMaintenance(row) {
  if (!row) {
    return null;
  }

  const maintenanceStatus = row.ativo === false ? "cancelada" : row.status;

  return {
    id: row.id,
    usuarioId: row.usuarioId,
    empresaId: row.empresaId,
    veiculoId: row.veiculoId,
    despesaVeiculoId: row.despesaVeiculoId,
    tipo: row.tipo,
    descricao: row.descricao,
    custo: Number(row.custo || 0),
    dataManutencao: row.dataManutencao,
    proximaManutencao: row.proximaManutencao,
    status: maintenanceStatus,
    observacoes: row.observacoes || "",
    integrarFinanceiro: row.integrarFinanceiro,
    ativo: row.ativo,
    veiculo: row.veiculoId
      ? {
          id: row.veiculoId,
          placa: row.veiculoPlaca,
          modelo: row.veiculoModelo,
          status: row.veiculoStatus,
        }
      : null,
    despesa: row.despesaVeiculoId
      ? {
          id: row.despesaVeiculoId,
          status: row.despesaStatus || "pendente",
          valor: Number(row.despesaValor || 0),
          dataDespesa: row.despesaData,
          dataVencimento: row.despesaVencimento,
          dataPagamento: row.despesaPagamento,
          lancamentoFinanceiroId: row.lancamentoFinanceiroId,
          integrarFinanceiro: Boolean(row.lancamentoFinanceiroId) || row.integrarFinanceiro,
        }
      : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function buildSelectQuery() {
  return `SELECT
      mv.id,
      mv.usuario_id AS "usuarioId",
      mv.empresa_id AS "empresaId",
      mv.veiculo_id AS "veiculoId",
      mv.despesa_veiculo_id AS "despesaVeiculoId",
      mv.tipo,
      mv.descricao,
      mv.custo,
      TO_CHAR(mv.data_manutencao, 'YYYY-MM-DD') AS "dataManutencao",
      TO_CHAR(mv.proxima_manutencao, 'YYYY-MM-DD') AS "proximaManutencao",
      mv.status,
      mv.observacoes,
      mv.integrar_financeiro AS "integrarFinanceiro",
      mv.ativo,
      v.placa AS "veiculoPlaca",
      v.modelo AS "veiculoModelo",
      v.status AS "veiculoStatus",
      dv.valor AS "despesaValor",
      lf.status AS "despesaStatus",
      TO_CHAR(dv.data_despesa, 'YYYY-MM-DD') AS "despesaData",
      TO_CHAR(dv.data_vencimento, 'YYYY-MM-DD') AS "despesaVencimento",
      TO_CHAR(dv.data_pagamento, 'YYYY-MM-DD') AS "despesaPagamento",
      dv.lancamento_financeiro_id AS "lancamentoFinanceiroId",
      mv.criado_em AS "criadoEm",
      mv.atualizado_em AS "atualizadoEm"
    FROM manutencoes_veiculos mv
    INNER JOIN veiculos v ON v.id = mv.veiculo_id
    LEFT JOIN despesas_veiculos dv ON dv.id = mv.despesa_veiculo_id
    LEFT JOIN lancamentos_financeiros lf ON lf.id = dv.lancamento_financeiro_id`;
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

function buildFleetExpensePayload(payload) {
  return {
    veiculoId: payload.veiculoId,
    tipo: "manutencao",
    descricao: payload.descricao,
    valor: payload.custo,
    status: "pendente",
    integrarFinanceiro: payload.integrarFinanceiro !== false,
    dataDespesa: payload.dataManutencao,
    observacoes: payload.observacoes || null,
  };
}

async function listByUserId(actor, filters = {}) {
  const tenant = buildTenantCondition({ actor, tableAlias: "mv" });
  const conditions = [tenant.condition];
  const values = [...tenant.params];

  if (!Object.hasOwn(filters, "ativo") || filters.ativo !== false) {
    conditions.push("mv.ativo = TRUE");
  }

  if (filters.veiculoId) {
    values.push(filters.veiculoId);
    conditions.push(`mv.veiculo_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`mv.status = $${values.length}`);
  }

  if (filters.tipo) {
    values.push(filters.tipo);
    conditions.push(`LOWER(mv.tipo) = LOWER($${values.length})`);
  }

  if (filters.dataInicio) {
    values.push(filters.dataInicio);
    conditions.push(`mv.data_manutencao >= $${values.length}::date`);
  }

  if (filters.dataFim) {
    values.push(filters.dataFim);
    conditions.push(`mv.data_manutencao <= $${values.length}::date`);
  }

  const result = await database.query(
    `${buildSelectQuery()}
    WHERE ${conditions.join(" AND ")}
    ORDER BY mv.data_manutencao DESC, mv.criado_em DESC`,
    values,
  );

  return result.rows.map(mapVehicleMaintenance);
}

async function findById(actor, maintenanceId, client = database) {
  const tenant = buildTenantCondition({ actor, tableAlias: "mv" });
  const maintenanceIdIndex = tenant.nextIndex;
  const result = await client.query(
    `${buildSelectQuery()}
    WHERE ${tenant.condition} AND mv.id = $${maintenanceIdIndex}`,
    [...tenant.params, maintenanceId],
  );

  return mapVehicleMaintenance(result.rows[0]);
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    await ensureVehicleExists(client, actor, payload.veiculoId);

    let despesaVeiculoId = null;
    if (payload.status !== "cancelada") {
      const expense = await fleetCostRepository.create(actor, buildFleetExpensePayload(payload));
      despesaVeiculoId = expense.id;
    }

    const result = await client.query(
      `INSERT INTO manutencoes_veiculos (
        usuario_id,
        empresa_id,
        veiculo_id,
        despesa_veiculo_id,
        tipo,
        descricao,
        custo,
        data_manutencao,
        proxima_manutencao,
        status,
        observacoes,
        integrar_financeiro
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        context.userId,
        context.empresaId,
        payload.veiculoId,
        despesaVeiculoId,
        payload.tipo,
        payload.descricao,
        payload.custo,
        payload.dataManutencao,
        payload.proximaManutencao || null,
        payload.status || "agendada",
        payload.observacoes || null,
        payload.integrarFinanceiro !== false,
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

async function updateById(actor, maintenanceId, payload) {
  const current = await findById(actor, maintenanceId);
  if (!current) {
    return null;
  }

  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const merged = {
      veiculoId: Object.hasOwn(payload, "veiculoId") ? payload.veiculoId : current.veiculoId,
      tipo: Object.hasOwn(payload, "tipo") ? payload.tipo : current.tipo,
      descricao: Object.hasOwn(payload, "descricao") ? payload.descricao : current.descricao,
      custo: Object.hasOwn(payload, "custo") ? payload.custo : current.custo,
      dataManutencao: Object.hasOwn(payload, "dataManutencao")
        ? payload.dataManutencao
        : current.dataManutencao,
      proximaManutencao: Object.hasOwn(payload, "proximaManutencao")
        ? payload.proximaManutencao
        : current.proximaManutencao,
      status: Object.hasOwn(payload, "status") ? payload.status : current.status,
      observacoes: Object.hasOwn(payload, "observacoes")
        ? payload.observacoes
        : current.observacoes,
      integrarFinanceiro: Object.hasOwn(payload, "integrarFinanceiro")
        ? payload.integrarFinanceiro
        : current.integrarFinanceiro,
    };

    await ensureVehicleExists(client, actor, merged.veiculoId);

    let despesaVeiculoId = current.despesaVeiculoId;
    const shouldBeCancelled = merged.status === "cancelada";

    if (shouldBeCancelled && current.despesaVeiculoId) {
      await fleetCostRepository.deleteById(actor, current.despesaVeiculoId);
    } else if (!shouldBeCancelled && current.despesaVeiculoId && current.status !== "cancelada") {
      await fleetCostRepository.updateById(actor, current.despesaVeiculoId, buildFleetExpensePayload(merged));
    } else if (!shouldBeCancelled) {
      const expense = await fleetCostRepository.create(actor, buildFleetExpensePayload(merged));
      despesaVeiculoId = expense.id;
    }

    const tenant = buildTenantCondition({ actor, tableAlias: "manutencoes_veiculos", startIndex: 2 });
    await client.query(
      `UPDATE manutencoes_veiculos
      SET veiculo_id = $${tenant.nextIndex},
          despesa_veiculo_id = $${tenant.nextIndex + 1},
          tipo = $${tenant.nextIndex + 2},
          descricao = $${tenant.nextIndex + 3},
          custo = $${tenant.nextIndex + 4},
          data_manutencao = $${tenant.nextIndex + 5},
          proxima_manutencao = $${tenant.nextIndex + 6},
          status = $${tenant.nextIndex + 7},
          observacoes = $${tenant.nextIndex + 8},
          integrar_financeiro = $${tenant.nextIndex + 9},
          ativo = $${tenant.nextIndex + 10},
          atualizado_em = NOW()
      WHERE id = $1 AND ${tenant.condition}`,
      [
        maintenanceId,
        ...tenant.params,
        merged.veiculoId,
        despesaVeiculoId,
        merged.tipo,
        merged.descricao,
        merged.custo,
        merged.dataManutencao,
        merged.proximaManutencao || null,
        merged.status,
        merged.observacoes || null,
        merged.integrarFinanceiro !== false,
        merged.status !== "cancelada",
      ],
    );

    await client.query("COMMIT");
    return findById(actor, maintenanceId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteById(actor, maintenanceId) {
  const current = await findById(actor, maintenanceId);
  if (!current) {
    return null;
  }

  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    if (current.despesaVeiculoId && current.status !== "cancelada") {
      await fleetCostRepository.deleteById(actor, current.despesaVeiculoId);
    }

    const tenant = buildTenantCondition({ actor, tableAlias: "manutencoes_veiculos", startIndex: 2 });
    await client.query(
      `UPDATE manutencoes_veiculos
      SET status = 'cancelada',
          ativo = FALSE,
          atualizado_em = NOW()
      WHERE id = $1 AND ${tenant.condition}`,
      [maintenanceId, ...tenant.params],
    );

    await client.query("COMMIT");
    return findById(actor, maintenanceId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listSupportData(actor) {
  const vehicleTenant = buildTenantCondition({ actor, tableAlias: "v" });
  const result = await database.query(
    `SELECT id, placa, modelo, status
    FROM veiculos v
    WHERE ${vehicleTenant.condition}
    ORDER BY placa ASC`,
    vehicleTenant.params,
  );

  return {
    veiculos: result.rows.map((row) => ({
      id: row.id,
      placa: row.placa,
      modelo: row.modelo,
      status: row.status,
    })),
  };
}

module.exports = {
  listByUserId,
  findById,
  create,
  updateById,
  deleteById,
  listSupportData,
};
