const database = require("../config/database");
const clientRepository = require("./clientRepository");
const deliveryRepository = require("./deliveryRepository");
const driverRepository = require("./driverRepository");
const fleetCostRepository = require("./fleetCostRepository");
const financeRepository = require("./financeRepository");
const proofRepository = require("./proofRepository");
const vehicleMaintenanceRepository = require("./vehicleMaintenanceRepository");
const vehicleRepository = require("./vehicleRepository");
const { buildTenantCondition } = require("./tenantContext");

function matchesDateRange(value, start, end) {
  if (!start || !end) {
    return true;
  }

  if (!value) {
    return false;
  }

  return value >= start && value <= end;
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function mapClientFilter(client) {
  return {
    id: client.id,
    nome: client.nome,
    documento: client.documento,
    status: client.status,
  };
}

function mapVehicleFilter(vehicle) {
  return {
    id: vehicle.id,
    placa: vehicle.placa,
    modelo: vehicle.modelo,
    status: vehicle.status,
  };
}

function mapDriverFilter(driver) {
  return {
    id: driver.id,
    nome: driver.nome,
    status: driver.status,
  };
}

async function listSupportData(actor) {
  const [clients, vehicles, drivers] = await Promise.all([
    clientRepository.listByUserId(actor),
    vehicleRepository.listByUserId(actor),
    driverRepository.listByUserId(actor),
  ]);

  return {
    clientes: clients.map(mapClientFilter),
    veiculos: vehicles.map(mapVehicleFilter),
    motoristas: drivers.map(mapDriverFilter),
  };
}

function filterDeliveries(deliveries, filters = {}) {
  return deliveries.filter(
    (delivery) =>
      (!filters.clienteId || delivery.clienteId === filters.clienteId) &&
      (!filters.status || delivery.status === filters.status) &&
      matchesDateRange(
        delivery.dataPrevista || delivery.criadoEm?.slice(0, 10),
        filters.dataInicio,
        filters.dataFim,
      ),
  );
}

function filterFinancialEntries(financialEntries, filters = {}) {
  return financialEntries.filter(
    (entry) =>
      (!filters.clienteId || entry.clienteId === filters.clienteId) &&
      (!filters.status || entry.status === filters.status) &&
      (!filters.tipo || entry.tipo === filters.tipo) &&
      matchesDateRange(entry.dataCompetencia, filters.dataInicio, filters.dataFim),
  );
}

function filterFleetExpenses(expenses, filters = {}) {
  return expenses.filter(
    (expense) =>
      (!filters.veiculoId || expense.veiculoId === filters.veiculoId) &&
      (!filters.motoristaId || expense.motoristaId === filters.motoristaId) &&
      (!filters.status || expense.status === filters.status) &&
      (!filters.tipo || expense.tipo === filters.tipo) &&
      matchesDateRange(expense.dataDespesa, filters.dataInicio, filters.dataFim),
  );
}

function filterMaintenances(maintenances, filters = {}) {
  return maintenances.filter(
    (maintenance) =>
      (!filters.veiculoId || maintenance.veiculoId === filters.veiculoId) &&
      (!filters.status || maintenance.status === filters.status) &&
      (!filters.tipo || String(maintenance.tipo).toLowerCase() === String(filters.tipo).toLowerCase()) &&
      matchesDateRange(maintenance.dataManutencao, filters.dataInicio, filters.dataFim),
  );
}

function buildDeliveriesSummary(deliveries) {
  const byStatus = deliveries.reduce((accumulator, delivery) => {
    accumulator[delivery.status] = (accumulator[delivery.status] || 0) + 1;
    return accumulator;
  }, {});

  const byRegionMap = deliveries.reduce((accumulator, delivery) => {
    const key = `${delivery.cidade || "Sem cidade"}|${delivery.estado || "--"}`;
    const current = accumulator.get(key) || {
      cidade: delivery.cidade || "Sem cidade",
      estado: delivery.estado || "--",
      total: 0,
      pendentes: 0,
      entregues: 0,
    };
    current.total += 1;
    if (delivery.status === "pendente") {
      current.pendentes += 1;
    }
    if (delivery.status === "entregue") {
      current.entregues += 1;
    }
    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  return {
    totalEntregas: deliveries.length,
    porStatus: byStatus,
    porCidadeEstado: [...byRegionMap.values()].sort((left, right) => right.total - left.total),
  };
}

async function listByClient(actor, filters) {
  const [clients, deliveries, financialEntries, proofs] = await Promise.all([
    clientRepository.listByUserId(actor),
    deliveryRepository.listByUserId(actor),
    financeRepository.listByUserId(actor, {
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
      status: filters.statusFinanceiro,
    }),
    proofRepository.listByUserId(actor, { ativo: true }),
  ]);

  const selectedClients = clients.filter(
    (client) => !filters.clienteId || client.id === filters.clienteId,
  );
  const filteredDeliveries = filterDeliveries(deliveries, {
    clienteId: filters.clienteId,
    status: filters.statusEntrega,
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
  });
  const filteredFinancialEntries = filterFinancialEntries(financialEntries, {
    clienteId: filters.clienteId,
    status: filters.statusFinanceiro,
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
  });
  const proofsByDelivery = new Map();

  for (const proof of proofs) {
    proofsByDelivery.set(
      proof.entregaId,
      (proofsByDelivery.get(proof.entregaId) || 0) + (proof.ativo ? 1 : 0),
    );
  }

  const rows = selectedClients.map((client) => {
    const clientDeliveries = filteredDeliveries.filter((delivery) => delivery.clienteId === client.id);
    const deliveryIds = new Set(clientDeliveries.map((delivery) => delivery.id));
    const clientFinancialEntries = filteredFinancialEntries.filter(
      (entry) => entry.clienteId === client.id || (entry.entregaId && deliveryIds.has(entry.entregaId)),
    );
    const totalComprovantes = clientDeliveries.reduce(
      (sum, delivery) => sum + Number(proofsByDelivery.get(delivery.id) || 0),
      0,
    );
    const receitaTotal = clientFinancialEntries
      .filter((entry) => entry.tipo === "receita" && entry.status !== "cancelado")
      .reduce((sum, entry) => sum + entry.valor, 0);
    const valorPendente = clientFinancialEntries
      .filter((entry) => ["pendente", "faturado"].includes(entry.status))
      .reduce((sum, entry) => sum + entry.valor, 0);
    const valorPago = clientFinancialEntries
      .filter((entry) => entry.status === "pago")
      .reduce((sum, entry) => sum + entry.valor, 0);
    const lancamentosVencidos = clientFinancialEntries.filter(
      (entry) =>
        ["pendente", "faturado"].includes(entry.status) &&
        entry.dataVencimento &&
        entry.dataVencimento < todayText(),
    ).length;

    return {
      clienteId: client.id,
      nome: client.nome,
      documento: client.documento,
      status: client.status,
      totalEntregas: clientDeliveries.length,
      entregasPendentes: clientDeliveries.filter((item) => item.status === "pendente").length,
      entregasEmRota: clientDeliveries.filter((item) => item.status === "em_rota").length,
      entregasEntregues: clientDeliveries.filter((item) => item.status === "entregue").length,
      entregasCanceladas: clientDeliveries.filter((item) => item.status === "cancelada").length,
      totalRotasVinculadas: clientDeliveries.filter((item) => item.rotaAtual).length,
      totalComprovantes,
      receitaTotal: Number(receitaTotal.toFixed(2)),
      valorPendente: Number(valorPendente.toFixed(2)),
      valorPago: Number(valorPago.toFixed(2)),
      lancamentosVencidos,
      ticketMedioPorEntrega:
        clientDeliveries.length === 0
          ? 0
          : Number((receitaTotal / clientDeliveries.length).toFixed(2)),
    };
  });

  return {
    clientes: rows,
    apoio: {
      clientes: selectedClients.map(mapClientFilter),
    },
  };
}

async function getClientReportDetails(actor, clientId) {
  const [client, deliveries, financialEntries, proofs] = await Promise.all([
    clientRepository.findById(actor, clientId),
    deliveryRepository.listByUserId(actor),
    financeRepository.listByUserId(actor),
    proofRepository.listByUserId(actor, { ativo: true }),
  ]);

  if (!client) {
    return null;
  }

  const clientDeliveries = deliveries
    .filter((delivery) => delivery.clienteId === clientId)
    .sort((left, right) =>
      String(right.dataPrevista || right.criadoEm || "").localeCompare(
        String(left.dataPrevista || left.criadoEm || ""),
      ),
    )
    .slice(0, 10);
  const deliveryIds = new Set(clientDeliveries.map((delivery) => delivery.id));
  const clientFinancialEntries = financialEntries
    .filter((entry) => entry.clienteId === clientId || (entry.entregaId && deliveryIds.has(entry.entregaId)))
    .slice(0, 10);
  const clientProofs = proofs
    .filter((proof) => deliveryIds.has(proof.entregaId))
    .slice(0, 20);

  const receitaTotal = clientFinancialEntries
    .filter((entry) => entry.tipo === "receita" && entry.status !== "cancelado")
    .reduce((sum, entry) => sum + entry.valor, 0);
  const valorPendente = clientFinancialEntries
    .filter((entry) => ["pendente", "faturado"].includes(entry.status))
    .reduce((sum, entry) => sum + entry.valor, 0);
  const valorPago = clientFinancialEntries
    .filter((entry) => entry.status === "pago")
    .reduce((sum, entry) => sum + entry.valor, 0);

  return {
    cliente: client,
    resumoOperacional: {
      totalEntregas: clientDeliveries.length,
      entregasPendentes: clientDeliveries.filter((item) => item.status === "pendente").length,
      entregasEmRota: clientDeliveries.filter((item) => item.status === "em_rota").length,
      entregasEntregues: clientDeliveries.filter((item) => item.status === "entregue").length,
      entregasCanceladas: clientDeliveries.filter((item) => item.status === "cancelada").length,
      totalRotasVinculadas: clientDeliveries.filter((item) => item.rotaAtual).length,
      totalComprovantes: clientProofs.length,
    },
    resumoFinanceiro: {
      receitaTotal: Number(receitaTotal.toFixed(2)),
      valorPendente: Number(valorPendente.toFixed(2)),
      valorPago: Number(valorPago.toFixed(2)),
      lancamentosVencidos: clientFinancialEntries.filter(
        (entry) =>
          ["pendente", "faturado"].includes(entry.status) &&
          entry.dataVencimento &&
          entry.dataVencimento < todayText(),
      ).length,
    },
    entregasRecentes: clientDeliveries,
    lancamentosRecentes: clientFinancialEntries,
    comprovantes: clientProofs,
  };
}

async function listLatestRouteAssignments(actor, deliveryIds) {
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
    return [];
  }

  const tenant = buildTenantCondition({ actor, tableAlias: "re" });
  const deliveryIdsIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT DISTINCT ON (re.entrega_id)
      re.entrega_id AS "entregaId",
      r.motorista_id AS "motoristaId",
      m.nome AS "motoristaNome",
      r.veiculo_id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      v.modelo AS "veiculoModelo",
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "dataRota",
      r.status AS "rotaStatus"
    FROM rota_entregas re
    INNER JOIN rotas_operacionais r ON r.id = re.rota_id
    LEFT JOIN motoristas m ON m.id = r.motorista_id
    LEFT JOIN veiculos v ON v.id = r.veiculo_id
    WHERE ${tenant.condition}
      AND re.entrega_id = ANY($${deliveryIdsIndex}::uuid[])
    ORDER BY re.entrega_id, re.ativo DESC, re.vinculado_em DESC`,
    [...tenant.params, deliveryIds],
  );

  return result.rows;
}

async function getDeliveriesReport(actor, filters) {
  const [deliveries, support] = await Promise.all([
    deliveryRepository.listByUserId(actor),
    listSupportData(actor),
  ]);
  const filtered = filterDeliveries(deliveries, filters);
  const summary = buildDeliveriesSummary(filtered);

  return {
    filtros: filters,
    resumo: summary,
    entregas: filtered,
    apoio: support,
  };
}

async function getFinancialReport(actor, filters) {
  const [financialEntries, support] = await Promise.all([
    financeRepository.listByUserId(actor, {
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
    }),
    listSupportData(actor),
  ]);
  const filtered = filterFinancialEntries(financialEntries, filters);
  const receitaTotal = filtered
    .filter((entry) => entry.tipo === "receita" && entry.status !== "cancelado")
    .reduce((sum, entry) => sum + entry.valor, 0);
  const despesaTotal = filtered
    .filter((entry) => ["despesa", "repasse"].includes(entry.tipo) && entry.status !== "cancelado")
    .reduce((sum, entry) => sum + entry.valor, 0);
  const porStatus = filtered.reduce((accumulator, entry) => {
    accumulator[entry.status] = Number(((accumulator[entry.status] || 0) + entry.valor).toFixed(2));
    return accumulator;
  }, {});
  const porTipo = filtered.reduce((accumulator, entry) => {
    accumulator[entry.tipo] = Number(((accumulator[entry.tipo] || 0) + entry.valor).toFixed(2));
    return accumulator;
  }, {});

  return {
    filtros: filters,
    resumo: {
      totalLancamentos: filtered.length,
      receitaTotal: Number(receitaTotal.toFixed(2)),
      despesaTotal: Number(despesaTotal.toFixed(2)),
      resultadoFinanceiro: Number((receitaTotal - despesaTotal).toFixed(2)),
      porStatus,
      porTipo,
    },
    lancamentos: filtered,
    apoio: support,
  };
}

async function getFleetReport(actor, filters) {
  const [deliveries, financialEntries, vehicleExpenses, vehicles, drivers, maintenances, support] =
    await Promise.all([
      deliveryRepository.listByUserId(actor),
      financeRepository.listByUserId(actor, {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
      }),
      fleetCostRepository.listByUserId(actor, {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        ativo: true,
      }),
      vehicleRepository.listByUserId(actor),
      driverRepository.listByUserId(actor),
      vehicleMaintenanceRepository.listByUserId(actor, {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        ativo: true,
      }),
      listSupportData(actor),
    ]);

  const filteredDeliveries = filterDeliveries(deliveries, filters);
  const filteredFinancialEntries = filterFinancialEntries(financialEntries, filters);
  const filteredExpenses = filterFleetExpenses(vehicleExpenses, filters);
  const filteredMaintenances = filterMaintenances(maintenances, filters);
  const deliveryIds = filteredDeliveries.map((delivery) => delivery.id);
  const assignments = await listLatestRouteAssignments(actor, deliveryIds);
  const assignmentByDeliveryId = new Map(assignments.map((item) => [item.entregaId, item]));
  const vehicleIdsInScope = new Set(assignments.map((item) => item.veiculoId).filter(Boolean));
  const driverIdsInScope = new Set(assignments.map((item) => item.motoristaId).filter(Boolean));

  const operationalRevenueEntries = filteredFinancialEntries.filter(
    (entry) =>
      entry.tipo === "receita" &&
      entry.status !== "cancelado" &&
      entry.entregaId &&
      assignmentByDeliveryId.has(entry.entregaId),
  );

  const scopedExpenses =
    filters.clienteId || filters.status
      ? filteredExpenses.filter(
          (expense) =>
            vehicleIdsInScope.has(expense.veiculoId) ||
            (expense.motoristaId && driverIdsInScope.has(expense.motoristaId)),
        )
      : filteredExpenses;

  const vehicleMap = new Map(
    vehicles.map((vehicle) => [
      vehicle.id,
      {
        veiculoId: vehicle.id,
        placa: vehicle.placa,
        modelo: vehicle.modelo,
        status: vehicle.status,
        totalEntregas: 0,
        receitaTotal: 0,
        despesaTotal: 0,
        totalManutencoes: 0,
        custoManutencao: 0,
        lucro: 0,
        margem: 0,
      },
    ]),
  );
  const driverMap = new Map(
    drivers.map((driver) => [
      driver.id,
      {
        motoristaId: driver.id,
        nome: driver.nome,
        status: driver.status,
        totalEntregas: 0,
        receitaTotal: 0,
        despesaTotal: 0,
        lucro: 0,
        margem: 0,
      },
    ]),
  );

  for (const delivery of filteredDeliveries) {
    const assignment = assignmentByDeliveryId.get(delivery.id);
    if (!assignment) {
      continue;
    }

    if (assignment.veiculoId && vehicleMap.has(assignment.veiculoId)) {
      vehicleMap.get(assignment.veiculoId).totalEntregas += 1;
    }

    if (assignment.motoristaId && driverMap.has(assignment.motoristaId)) {
      driverMap.get(assignment.motoristaId).totalEntregas += 1;
    }
  }

  for (const entry of operationalRevenueEntries) {
    const assignment = assignmentByDeliveryId.get(entry.entregaId);
    if (!assignment) {
      continue;
    }

    if (assignment.veiculoId && vehicleMap.has(assignment.veiculoId)) {
      vehicleMap.get(assignment.veiculoId).receitaTotal += entry.valor;
    }

    if (assignment.motoristaId && driverMap.has(assignment.motoristaId)) {
      driverMap.get(assignment.motoristaId).receitaTotal += entry.valor;
    }
  }

  for (const expense of scopedExpenses) {
    if (expense.veiculoId && vehicleMap.has(expense.veiculoId)) {
      vehicleMap.get(expense.veiculoId).despesaTotal += expense.valor;
    }

    if (expense.motoristaId && driverMap.has(expense.motoristaId)) {
      driverMap.get(expense.motoristaId).despesaTotal += expense.valor;
    }
  }

  for (const maintenance of filteredMaintenances) {
    if (maintenance.veiculoId && vehicleMap.has(maintenance.veiculoId)) {
      vehicleMap.get(maintenance.veiculoId).totalManutencoes += 1;
      vehicleMap.get(maintenance.veiculoId).custoManutencao += maintenance.custo;
    }
  }

  const finalize = (item) => {
    const receitaTotal = Number(item.receitaTotal.toFixed(2));
    const despesaTotal = Number(item.despesaTotal.toFixed(2));
    const lucro = Number((receitaTotal - despesaTotal).toFixed(2));
    const margem = receitaTotal > 0 ? Number(((lucro / receitaTotal) * 100).toFixed(2)) : 0;
    return {
      ...item,
      receitaTotal,
      despesaTotal,
      lucro,
      margem,
      resultadoLiquido: lucro,
      rentabilidade: margem,
      custoManutencao: Number((item.custoManutencao || 0).toFixed(2)),
    };
  };

  const vehicleRows = [...vehicleMap.values()]
    .filter(
      (item) =>
        item.totalEntregas > 0 ||
        item.receitaTotal > 0 ||
        item.despesaTotal > 0 ||
        item.totalManutencoes > 0,
    )
    .map(finalize)
    .sort((left, right) => right.lucro - left.lucro);
  const driverRows = [...driverMap.values()]
    .filter((item) => item.totalEntregas > 0 || item.receitaTotal > 0 || item.despesaTotal > 0)
    .map(finalize)
    .sort((left, right) => right.lucro - left.lucro);

  const receitaTotal = Number(
    operationalRevenueEntries.reduce((sum, entry) => sum + entry.valor, 0).toFixed(2),
  );
  const despesaTotal = Number(scopedExpenses.reduce((sum, entry) => sum + entry.valor, 0).toFixed(2));
  const lucroOperacional = Number((receitaTotal - despesaTotal).toFixed(2));
  const margemOperacional = receitaTotal > 0 ? Number(((lucroOperacional / receitaTotal) * 100).toFixed(2)) : 0;
  const custosPorTipo = scopedExpenses.reduce((accumulator, expense) => {
    accumulator[expense.tipo] = Number(((accumulator[expense.tipo] || 0) + expense.valor).toFixed(2));
    return accumulator;
  }, {});
  const despesasPorStatus = scopedExpenses.reduce((accumulator, expense) => {
    accumulator[expense.status] = Number(((accumulator[expense.status] || 0) + expense.valor).toFixed(2));
    return accumulator;
  }, {});
  const manutencoesPorVeiculo = filteredMaintenances.reduce((accumulator, maintenance) => {
    const key = maintenance.veiculoId || "sem-veiculo";
    const current = accumulator.get(key) || {
      veiculoId: maintenance.veiculoId,
      placa: maintenance.veiculo?.placa || "Sem placa",
      modelo: maintenance.veiculo?.modelo || "Sem modelo",
      totalManutencoes: 0,
      custoTotal: 0,
    };
    current.totalManutencoes += 1;
    current.custoTotal += maintenance.custo;
    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  return {
    filtros: filters,
    resumo: {
      totalEntregasRentaveis: filteredDeliveries.length,
      totalVeiculosComMovimento: vehicleRows.length,
      totalMotoristasComMovimento: driverRows.length,
      receitaTotal,
      despesaTotal,
      lucroOperacional,
      resultadoLiquido: lucroOperacional,
      margemOperacional,
      lancamentosVencidos: scopedExpenses.filter(
        (expense) =>
          expense.status === "pendente" &&
          expense.dataVencimento &&
          expense.dataVencimento < todayText(),
      ).length,
      custosPorTipo,
      despesasPorStatus,
    },
    veiculos: vehicleRows,
    motoristas: driverRows,
    manutencoesPorVeiculo: [...manutencoesPorVeiculo.values()].map((item) => ({
      ...item,
      custoTotal: Number(item.custoTotal.toFixed(2)),
    })),
    despesas: scopedExpenses,
    ranking: {
      topVeiculosLucratividade: vehicleRows.slice(0, 5),
      topMotoristasLucratividade: driverRows.slice(0, 5),
      maioresDespesas: [...scopedExpenses].sort((left, right) => right.valor - left.valor).slice(0, 5),
      custosPorVeiculo: [...vehicleRows].sort((left, right) => right.despesaTotal - left.despesaTotal).slice(0, 10),
    },
    apoio: support,
  };
}

async function getFleetCostReport(actor, filters) {
  return getFleetReport(actor, filters);
}

async function getSummaryReport(actor, filters) {
  const [deliveriesReport, financialReport, fleetReport, support] = await Promise.all([
    getDeliveriesReport(actor, filters),
    getFinancialReport(actor, filters),
    getFleetReport(actor, filters),
    listSupportData(actor),
  ]);

  return {
    filtros: filters,
    resumo: {
      totalEntregas: deliveriesReport.resumo.totalEntregas,
      receitaTotal: financialReport.resumo.receitaTotal,
      despesaTotal: Number(
        (financialReport.resumo.despesaTotal + fleetReport.resumo.despesaTotal).toFixed(2),
      ),
      resultadoFinanceiro: Number(
        (
          financialReport.resumo.receitaTotal -
          (financialReport.resumo.despesaTotal + fleetReport.resumo.despesaTotal)
        ).toFixed(2),
      ),
      entregasPorStatus: deliveriesReport.resumo.porStatus,
      lancamentosPorStatus: financialReport.resumo.porStatus,
      despesasVeiculosPorStatus: fleetReport.resumo.despesasPorStatus,
    },
    entregas: deliveriesReport.resumo,
    financeiro: financialReport.resumo,
    frota: fleetReport.resumo,
    apoio: support,
  };
}

module.exports = {
  listSupportData,
  listByClient,
  getClientReportDetails,
  getDeliveriesReport,
  getFinancialReport,
  getFleetReport,
  getFleetCostReport,
  getSummaryReport,
};
