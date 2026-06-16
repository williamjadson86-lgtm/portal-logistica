const deliveryRepository = require("./deliveryRepository");
const routePlanningRepository = require("./routePlanningRepository");
const driverRepository = require("./driverRepository");
const fleetCostRepository = require("./fleetCostRepository");
const vehicleMaintenanceRepository = require("./vehicleMaintenanceRepository");
const vehicleRepository = require("./vehicleRepository");
const financeRepository = require("./financeRepository");
const proofRepository = require("./proofRepository");
const userRepository = require("./userRepository");
const companyRepository = require("./companyRepository");

function isWithinRange(value, start, end) {
  if (!value) {
    return false;
  }

  return value >= start && value <= end;
}

async function getOperationalDashboard(actor, filter) {
  const [deliveries, routes, drivers, vehicles, financialEntries, proofs, vehicleExpenses, maintenances, userSummary, companyList] = await Promise.all([
    deliveryRepository.listForUser(actor),
    routePlanningRepository.listForUser(actor),
    driverRepository.listByUserId(actor),
    vehicleRepository.listByUserId(actor),
    financeRepository.listByUserId(actor, {
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
    }),
    proofRepository.listByUserId(actor, { ativo: true }),
    fleetCostRepository.listByUserId(actor, {
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
    }),
    vehicleMaintenanceRepository.listByUserId(actor, {
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
    }),
    userRepository.getCompanyUserSummary(actor),
    companyRepository.listByActor(actor),
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
  const totalDespesasFrotaPeriodo = Number(
    vehicleExpenses.reduce((sum, entry) => sum + entry.valor, 0).toFixed(2),
  );
  const despesasPagasFrotaPeriodo = Number(
    vehicleExpenses
      .filter((entry) => entry.status === "pago")
      .reduce((sum, entry) => sum + entry.valor, 0)
      .toFixed(2),
  );
  const despesasPendentesFrotaPeriodo = Number(
    vehicleExpenses
      .filter((entry) => entry.status === "pendente")
      .reduce((sum, entry) => sum + entry.valor, 0)
      .toFixed(2),
  );
  const custoManutencaoPeriodo = Number(
    vehicleExpenses
      .filter((entry) => entry.tipo === "manutencao")
      .reduce((sum, entry) => sum + entry.valor, 0)
      .toFixed(2),
  );
  const despesasFrotaVencidas = vehicleExpenses.filter(
    (entry) =>
      ["pendente", "faturado"].includes(entry.status) &&
      entry.dataVencimento &&
      entry.dataVencimento < filter.hoje,
  ).length;
  const lucroOperacionalPeriodo = Number(
    (receitaTotalPeriodo - totalDespesasFrotaPeriodo).toFixed(2),
  );
  const manutencoesVencidas = maintenances.filter(
    (maintenance) =>
      maintenance.proximaManutencao &&
      maintenance.proximaManutencao < filter.hoje &&
      ["agendada", "em_execucao"].includes(maintenance.status),
  ).length;
  const manutencoesConcluidasPeriodo = maintenances.filter(
    (maintenance) => maintenance.status === "concluida",
  ).length;
  const margemOperacionalPeriodo =
    receitaTotalPeriodo === 0
      ? 0
      : Number(((lucroOperacionalPeriodo / receitaTotalPeriodo) * 100).toFixed(2));
  const vehicleCostMap = new Map();
  const driverCostMap = new Map();

  for (const expense of vehicleExpenses) {
    if (expense.veiculoId) {
      const current = vehicleCostMap.get(expense.veiculoId) || {
        veiculoId: expense.veiculoId,
        placa: expense.veiculo?.placa || "Sem placa",
        modelo: expense.veiculo?.modelo || "Sem modelo",
        custoTotal: 0,
      };
      current.custoTotal += expense.valor;
      vehicleCostMap.set(expense.veiculoId, current);
    }

    if (expense.motoristaId) {
      const current = driverCostMap.get(expense.motoristaId) || {
        motoristaId: expense.motoristaId,
        nome: expense.motorista?.nome || "Motorista nao informado",
        custoTotal: 0,
      };
      current.custoTotal += expense.valor;
      driverCostMap.set(expense.motoristaId, current);
    }
  }

  const veiculosMaiorDespesa = [...vehicleCostMap.values()]
    .map((item) => ({
      ...item,
      custoTotal: Number(item.custoTotal.toFixed(2)),
    }))
    .sort((left, right) => right.custoTotal - left.custoTotal)
    .slice(0, 5);
  const motoristasMaiorDespesa = [...driverCostMap.values()]
    .map((item) => ({
      ...item,
      custoTotal: Number(item.custoTotal.toFixed(2)),
    }))
    .sort((left, right) => right.custoTotal - left.custoTotal)
    .slice(0, 5);
  const custoMedioPorVeiculo =
    vehicleCostMap.size === 0
      ? 0
      : Number((totalDespesasFrotaPeriodo / vehicleCostMap.size).toFixed(2));
  const custoMedioPorMotorista =
    driverCostMap.size === 0
      ? 0
      : Number((totalDespesasFrotaPeriodo / driverCostMap.size).toFixed(2));
  const despesasPorTipo = Object.entries(
    vehicleExpenses.reduce((accumulator, expense) => {
      accumulator[expense.tipo] = Number(
        ((accumulator[expense.tipo] || 0) + expense.valor).toFixed(2),
      );
      return accumulator;
    }, {}),
  )
    .map(([tipo, valor]) => ({ tipo, valor }))
    .sort((left, right) => right.valor - left.valor);
  const despesasPorVeiculo = veiculosMaiorDespesa;

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
      manutencoesProgramadas: maintenances.length,
      receitaTotalPeriodo,
      totalDespesasFrotaPeriodo,
      despesasPendentesFrotaPeriodo,
      despesasPagasFrotaPeriodo,
      custoManutencaoPeriodo,
      lucroOperacionalPeriodo,
      resultadoLiquidoPeriodo: lucroOperacionalPeriodo,
      margemOperacionalPeriodo,
      valoresPendentes,
      valoresPagos,
      lancamentosVencidos,
      totalUsuarios: Number(userSummary.total || 0),
      usuariosAtivos: Number(userSummary.ativos || 0),
      usuariosBloqueados: Number(userSummary.bloqueados || 0),
      empresaAtiva: companyList[0]?.status === "ativo" ? 1 : 0,
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
      despesasFrotaVencidas,
      manutencoesVencidas,
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
      manutencoesConcluidasPeriodo,
      receitaTotalPeriodo,
      totalDespesasFrotaPeriodo,
      despesasPendentesFrotaPeriodo,
      despesasPagasFrotaPeriodo,
      custoManutencaoPeriodo,
      lucroOperacionalPeriodo,
      resultadoLiquidoPeriodo: lucroOperacionalPeriodo,
      margemOperacionalPeriodo,
      valoresPendentes,
      valoresPagos,
      lancamentosVencidos,
      despesasFrotaVencidas,
    },
    frota: {
      custoTotalFrotaPeriodo: totalDespesasFrotaPeriodo,
      despesasPendentesFrotaPeriodo,
      despesasPagasFrotaPeriodo,
      custoManutencaoPeriodo,
      custoMedioPorVeiculo,
      custoMedioPorMotorista,
      despesasPorVeiculo,
      despesasPorTipo,
      veiculosMaiorDespesa,
      motoristasMaiorDespesa,
      manutencoesVencidas,
      lucroLiquidoPeriodo: lucroOperacionalPeriodo,
      margemOperacionalPeriodo,
    },
  };
}

module.exports = {
  getOperationalDashboard,
};
