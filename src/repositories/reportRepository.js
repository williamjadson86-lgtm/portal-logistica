const database = require("../config/database");
const clientRepository = require("./clientRepository");
const deliveryRepository = require("./deliveryRepository");
const driverRepository = require("./driverRepository");
const fleetCostRepository = require("./fleetCostRepository");
const financeRepository = require("./financeRepository");
const proofRepository = require("./proofRepository");
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

function mapClientFilter(client) {
  return {
    id: client.id,
    nome: client.nome,
    documento: client.documento,
    status: client.status,
  };
}

async function listClientFilters(actor) {
  const clients = await clientRepository.listByUserId(actor);
  return clients.map(mapClientFilter);
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
  const proofsByDelivery = new Map();

  for (const proof of proofs) {
    proofsByDelivery.set(
      proof.entregaId,
      (proofsByDelivery.get(proof.entregaId) || 0) + (proof.ativo ? 1 : 0),
    );
  }

  const rows = selectedClients.map((client) => {
    const clientDeliveries = deliveries.filter(
      (delivery) =>
        delivery.clienteId === client.id &&
        matchesDateRange(
          delivery.dataPrevista || delivery.criadoEm?.slice(0, 10),
          filters.dataInicio,
          filters.dataFim,
        ) &&
        (!filters.statusEntrega || delivery.status === filters.statusEntrega),
    );
    const deliveryIds = new Set(clientDeliveries.map((delivery) => delivery.id));
    const clientFinancialEntries = financialEntries.filter(
      (entry) =>
        entry.clienteId === client.id ||
        (entry.entregaId && deliveryIds.has(entry.entregaId)),
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
        entry.dataVencimento < new Date().toISOString().slice(0, 10),
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
          entry.dataVencimento < new Date().toISOString().slice(0, 10),
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

async function getFleetCostReport(actor, filters) {
  const [deliveries, financialEntries, vehicleExpenses, vehicles, drivers] = await Promise.all([
    deliveryRepository.listByUserId(actor),
    financeRepository.listByUserId(actor, {
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
      status: filters.statusFinanceiro,
    }),
    fleetCostRepository.listByUserId(actor, {
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
      status: filters.statusFinanceiro,
    }),
    vehicleRepository.listByUserId(actor),
    driverRepository.listByUserId(actor),
  ]);

  const filteredDeliveries = deliveries.filter(
    (delivery) =>
      matchesDateRange(
        delivery.dataPrevista || delivery.criadoEm?.slice(0, 10),
        filters.dataInicio,
        filters.dataFim,
      ) &&
      (!filters.clienteId || delivery.clienteId === filters.clienteId) &&
      (!filters.statusEntrega || delivery.status === filters.statusEntrega),
  );
  const deliveryIds = filteredDeliveries.map((delivery) => delivery.id);
  const assignments = await listLatestRouteAssignments(actor, deliveryIds);
  const assignmentByDeliveryId = new Map(assignments.map((item) => [item.entregaId, item]));
  const vehicleIdsInScope = new Set(assignments.map((item) => item.veiculoId).filter(Boolean));
  const driverIdsInScope = new Set(assignments.map((item) => item.motoristaId).filter(Boolean));

  const operationalRevenueEntries = financialEntries.filter(
    (entry) =>
      entry.tipo === "receita" &&
      entry.status !== "cancelado" &&
      entry.entregaId &&
      assignmentByDeliveryId.has(entry.entregaId),
  );

  const scopedExpenses =
    filters.clienteId || filters.statusEntrega
      ? vehicleExpenses.filter(
          (expense) =>
            vehicleIdsInScope.has(expense.veiculoId) ||
            (expense.motoristaId && driverIdsInScope.has(expense.motoristaId)),
        )
      : vehicleExpenses;

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

  const scopedVehicleIds =
    filters.clienteId || filters.statusEntrega ? vehicleIdsInScope : new Set(vehicles.map((item) => item.id));
  const scopedDriverIds =
    filters.clienteId || filters.statusEntrega ? driverIdsInScope : new Set(drivers.map((item) => item.id));

  for (const expense of scopedExpenses) {
    if (expense.veiculoId && vehicleMap.has(expense.veiculoId) && scopedVehicleIds.has(expense.veiculoId)) {
      vehicleMap.get(expense.veiculoId).despesaTotal += expense.valor;
    }

    if (expense.motoristaId && driverMap.has(expense.motoristaId) && scopedDriverIds.has(expense.motoristaId)) {
      driverMap.get(expense.motoristaId).despesaTotal += expense.valor;
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
    };
  };

  const vehicleRows = [...vehicleMap.values()]
    .filter((item) => item.totalEntregas > 0 || item.receitaTotal > 0 || item.despesaTotal > 0)
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

  return {
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
          ["pendente", "faturado"].includes(expense.status) &&
          expense.dataVencimento &&
          expense.dataVencimento < new Date().toISOString().slice(0, 10),
      ).length,
      custosPorTipo,
    },
    veiculos: vehicleRows,
    motoristas: driverRows,
    ranking: {
      topVeiculosLucratividade: vehicleRows.slice(0, 5),
      topMotoristasLucratividade: driverRows.slice(0, 5),
      maioresDespesas: [...scopedExpenses]
        .sort((left, right) => right.valor - left.valor)
        .slice(0, 5),
    },
  };
}

module.exports = {
  listByClient,
  getClientReportDetails,
  getFleetCostReport,
};
