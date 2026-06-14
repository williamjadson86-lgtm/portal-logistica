const deliveryRepository = require("./deliveryRepository");
const routePlanningRepository = require("./routePlanningRepository");
const driverRepository = require("./driverRepository");
const vehicleRepository = require("./vehicleRepository");
const financeRepository = require("./financeRepository");
const proofRepository = require("./proofRepository");

function isWithinRange(value, start, end) {
  if (!value) {
    return false;
  }

  return value >= start && value <= end;
}

async function getOperationalDashboard(actor, filter) {
  const [deliveries, routes, drivers, vehicles, financialEntries, proofs] = await Promise.all([
    deliveryRepository.listForUser(actor),
    routePlanningRepository.listForUser(actor),
    driverRepository.listByUserId(actor),
    vehicleRepository.listByUserId(actor),
    financeRepository.listByUserId(actor, {
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
    }),
    proofRepository.listByUserId(actor, { ativo: true }),
  ]);

  const deliveriesInPeriod = deliveries.filter((delivery) =>
    isWithinRange(delivery.dataPrevista || delivery.criadoEm?.slice(0, 10), filter.dataInicio, filter.dataFim),
  );
  const deliveredInPeriod = deliveries.filter(
    (delivery) =>
      delivery.status === "entregue" &&
      isWithinRange(delivery.atualizadoEm?.slice(0, 10), filter.dataInicio, filter.dataFim),
  );
  const routesInPeriod = routes.filter((route) =>
    isWithinRange(route.dataRota, filter.dataInicio, filter.dataFim),
  );
  const completedRoutesInPeriod = routes.filter(
    (route) =>
      route.status === "concluida" &&
      isWithinRange(route.atualizadoEm?.slice(0, 10), filter.dataInicio, filter.dataFim),
  );
  const proofsInPeriod = proofs.filter((proof) =>
    isWithinRange(proof.criadoEm?.slice(0, 10), filter.dataInicio, filter.dataFim),
  );
  const deliveredWithoutProof = deliveries.filter(
    (delivery) =>
      delivery.status === "entregue" &&
      !proofs.some((proof) => proof.entregaId === delivery.id && proof.ativo),
  );

  const totalEntregasPeriodo = deliveriesInPeriod.length;
  const entregasConcluidasPeriodo = deliveredInPeriod.length;
  const percentualConclusao =
    totalEntregasPeriodo === 0
      ? 0
      : Number(((entregasConcluidasPeriodo / totalEntregasPeriodo) * 100).toFixed(1));
  const mediaEntregasPorRota =
    routesInPeriod.length === 0
      ? 0
      : Number(
          (
            routesInPeriod.reduce(
              (accumulator, route) => accumulator + Number(route.totalEntregasAtivas || 0),
              0,
            ) / routesInPeriod.length
          ).toFixed(2),
        );

  const receitaTotalPeriodo = Number(
    financialEntries
      .filter((entry) => entry.tipo === "receita" && entry.status !== "cancelado")
      .reduce((sum, entry) => sum + entry.valor, 0)
      .toFixed(2),
  );
  const valoresPendentes = Number(
    financialEntries
      .filter((entry) => ["pendente", "faturado"].includes(entry.status))
      .reduce((sum, entry) => sum + entry.valor, 0)
      .toFixed(2),
  );
  const valoresPagos = Number(
    financialEntries
      .filter((entry) => entry.status === "pago")
      .reduce((sum, entry) => sum + entry.valor, 0)
      .toFixed(2),
  );
  const lancamentosVencidos = financialEntries.filter(
    (entry) =>
      ["pendente", "faturado"].includes(entry.status) &&
      entry.dataVencimento &&
      entry.dataVencimento < filter.hoje,
  ).length;

  return {
    filtro: {
      periodo: filter.periodo,
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
    },
    metricas: {
      totalEntregas: totalEntregasPeriodo,
      entregasPendentes: deliveriesInPeriod.filter((delivery) => delivery.status === "pendente").length,
      entregasEmTransito: deliveriesInPeriod.filter((delivery) => delivery.status === "em_transito").length,
      entregasEmRota: deliveriesInPeriod.filter((delivery) => delivery.status === "em_rota").length,
      entregasEntregues: deliveriesInPeriod.filter((delivery) => delivery.status === "entregue").length,
      rotasPlanejadas: routesInPeriod.filter((route) => route.status === "planejada").length,
      rotasEmAndamento: routes.filter((route) => route.status === "em_andamento").length,
      rotasConcluidas: routesInPeriod.filter((route) => route.status === "concluida").length,
      motoristasAtivos: drivers.filter((driver) => driver.status === "ativo").length,
      veiculosDisponiveis: vehicles.filter((vehicle) => vehicle.status === "disponivel").length,
      veiculosEmRota: vehicles.filter((vehicle) => vehicle.status === "em_rota").length,
      veiculosEmManutencao: vehicles.filter((vehicle) => vehicle.status === "manutencao").length,
      receitaTotalPeriodo,
      valoresPendentes,
      valoresPagos,
      lancamentosVencidos,
    },
    alertas: {
      entregasPendentesVencidas: deliveries.filter(
        (delivery) =>
          delivery.status === "pendente" &&
          delivery.dataPrevista &&
          delivery.dataPrevista < filter.hoje,
      ).length,
      rotasPlanejadasHoje: routes.filter(
        (route) => route.status === "planejada" && route.dataRota === filter.hoje,
      ).length,
      veiculosEmManutencao: vehicles.filter((vehicle) => vehicle.status === "manutencao").length,
      motoristasInativos: drivers.filter((driver) => driver.status === "inativo").length,
      entregasEntreguesSemComprovante: deliveredWithoutProof.length,
      entregasSemRota: deliveries.filter(
        (delivery) =>
          ["pendente", "coletada", "em_transito"].includes(delivery.status) && !delivery.rotaAtual,
      ).length,
      rotasEmAndamento: routes.filter((route) => route.status === "em_andamento").length,
      lancamentosVencidos,
    },
    produtividade: {
      entregasConcluidasPeriodo,
      percentualConclusao,
      mediaEntregasPorRota,
      rotasConcluidasPeriodo: completedRoutesInPeriod.length,
      entregasSemRota: deliveries.filter(
        (delivery) =>
          ["pendente", "coletada", "em_transito"].includes(delivery.status) && !delivery.rotaAtual,
      ).length,
      totalComprovantesPeriodo: proofsInPeriod.length,
      entregasEntreguesSemComprovante: deliveredWithoutProof.length,
      receitaTotalPeriodo,
      valoresPendentes,
      valoresPagos,
      lancamentosVencidos,
    },
  };
}

module.exports = {
  getOperationalDashboard,
};
