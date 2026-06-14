const clientRepository = require("./clientRepository");
const deliveryRepository = require("./deliveryRepository");
const financeRepository = require("./financeRepository");
const proofRepository = require("./proofRepository");

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

module.exports = {
  listByClient,
  getClientReportDetails,
};
