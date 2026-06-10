const database = require("../config/database");

async function getOperationalDashboard(userId, filter) {
  const params = [userId, filter.dataInicio, filter.dataFim, filter.hoje];

  const [
    deliveryMetricsResult,
    routeMetricsResult,
    workforceMetricsResult,
    financialMetricsResult,
    alertsResult,
    productivityBaseResult,
    routeAverageResult,
  ] = await Promise.all([
    database.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
        COUNT(*) FILTER (WHERE status = 'em_transito')::int AS "emTransito",
        COUNT(*) FILTER (WHERE status = 'em_rota')::int AS "emRota",
        COUNT(*) FILTER (WHERE status = 'entregue')::int AS entregues
      FROM entregas
      WHERE usuario_id = $1
        AND criado_em::date BETWEEN $2::date AND $3::date`,
      params.slice(0, 3),
    ),
    database.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'planejada')::int AS planejadas,
        COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS "emAndamento",
        COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas
      FROM rotas_operacionais
      WHERE usuario_id = $1
        AND data_rota BETWEEN $2::date AND $3::date`,
      params.slice(0, 3),
    ),
    database.query(
      `SELECT
        (SELECT COUNT(*)::int FROM motoristas WHERE usuario_id = $1 AND status = 'ativo') AS "motoristasAtivos",
        (SELECT COUNT(*)::int FROM veiculos WHERE usuario_id = $1 AND status = 'disponivel') AS "veiculosDisponiveis",
        (SELECT COUNT(*)::int FROM veiculos WHERE usuario_id = $1 AND status = 'em_rota') AS "veiculosEmRota",
        (SELECT COUNT(*)::int FROM veiculos WHERE usuario_id = $1 AND status = 'manutencao') AS "veiculosEmManutencao"`,
      [userId],
    ),
    database.query(
      `SELECT
        COALESCE(SUM(valor) FILTER (
          WHERE tipo = 'receita'
            AND status <> 'cancelado'
        ), 0)::numeric(12, 2) AS "receitaTotalPeriodo",
        COALESCE(SUM(valor) FILTER (
          WHERE status IN ('pendente', 'faturado')
        ), 0)::numeric(12, 2) AS "valoresPendentes",
        COALESCE(SUM(valor) FILTER (
          WHERE status = 'pago'
        ), 0)::numeric(12, 2) AS "valoresPagos",
        COUNT(*) FILTER (
          WHERE status IN ('pendente', 'faturado')
            AND data_vencimento IS NOT NULL
            AND data_vencimento < $4::date
        )::int AS "lancamentosVencidos"
      FROM lancamentos_financeiros
      WHERE usuario_id = $1
        AND data_competencia BETWEEN $2::date AND $3::date`,
      params,
    ),
    database.query(
      `SELECT
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.status = 'pendente'
            AND e.previsao_entrega IS NOT NULL
            AND e.previsao_entrega < $4::date) AS "entregasPendentesVencidas",
        (SELECT COUNT(*)::int
          FROM rotas_operacionais r
          WHERE r.usuario_id = $1
            AND r.status = 'planejada'
            AND r.data_rota = $4::date) AS "rotasPlanejadasHoje",
        (SELECT COUNT(*)::int
          FROM veiculos v
          WHERE v.usuario_id = $1
            AND v.status = 'manutencao') AS "veiculosEmManutencao",
        (SELECT COUNT(*)::int
          FROM motoristas m
          WHERE m.usuario_id = $1
            AND m.status = 'inativo') AS "motoristasInativos",
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.status = 'entregue'
            AND NOT EXISTS (
              SELECT 1
              FROM comprovantes c
              WHERE c.entrega_id = e.id
                AND c.ativo = TRUE
            )) AS "entregasEntreguesSemComprovante",
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.criado_em::date BETWEEN $2::date AND $3::date
            AND e.status IN ('pendente', 'coletada', 'em_transito')
            AND NOT EXISTS (
              SELECT 1
              FROM rota_entregas re
              WHERE re.entrega_id = e.id
                AND re.ativo = TRUE
            )) AS "entregasSemRota",
        (SELECT COUNT(*)::int
          FROM rotas_operacionais r
          WHERE r.usuario_id = $1
            AND r.status = 'em_andamento') AS "rotasEmAndamento",
        (SELECT COUNT(*)::int
          FROM lancamentos_financeiros lf
          WHERE lf.usuario_id = $1
            AND lf.status IN ('pendente', 'faturado')
            AND lf.data_vencimento IS NOT NULL
            AND lf.data_vencimento < $4::date) AS "lancamentosVencidos"`,
      params,
    ),
    database.query(
      `SELECT
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.criado_em::date BETWEEN $2::date AND $3::date) AS "totalEntregasPeriodo",
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.status = 'entregue'
            AND e.atualizado_em::date BETWEEN $2::date AND $3::date) AS "entregasConcluidasPeriodo",
        (SELECT COUNT(*)::int
          FROM rotas_operacionais r
          WHERE r.usuario_id = $1
            AND r.status = 'concluida'
            AND r.atualizado_em::date BETWEEN $2::date AND $3::date) AS "rotasConcluidasPeriodo",
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.status IN ('pendente', 'coletada', 'em_transito')
            AND NOT EXISTS (
              SELECT 1
              FROM rota_entregas re
              WHERE re.entrega_id = e.id
                AND re.ativo = TRUE
            )) AS "entregasSemRotaAtual",
        (SELECT COUNT(*)::int
          FROM comprovantes c
          WHERE c.usuario_id = $1
            AND c.ativo = TRUE
            AND c.criado_em::date BETWEEN $2::date AND $3::date) AS "totalComprovantesPeriodo",
        (SELECT COUNT(*)::int
          FROM entregas e
          WHERE e.usuario_id = $1
            AND e.status = 'entregue'
            AND NOT EXISTS (
              SELECT 1
              FROM comprovantes c
              WHERE c.entrega_id = e.id
                AND c.ativo = TRUE
            )) AS "entregasEntreguesSemComprovante"`,
      params.slice(0, 3),
    ),
    database.query(
      `SELECT
        COALESCE(AVG(route_delivery_count), 0)::numeric(10, 2) AS media
      FROM (
        SELECT
          r.id,
          COUNT(re.id)::numeric AS route_delivery_count
        FROM rotas_operacionais r
        LEFT JOIN rota_entregas re ON re.rota_id = r.id
        WHERE r.usuario_id = $1
          AND r.data_rota BETWEEN $2::date AND $3::date
        GROUP BY r.id
      ) route_metrics`,
      params.slice(0, 3),
    ),
  ]);

  const deliveryMetrics = deliveryMetricsResult.rows[0];
  const routeMetrics = routeMetricsResult.rows[0];
  const workforceMetrics = workforceMetricsResult.rows[0];
  const financialMetrics = financialMetricsResult.rows[0];
  const alerts = alertsResult.rows[0];
  const productivityBase = productivityBaseResult.rows[0];
  const averagePerRoute = Number(routeAverageResult.rows[0]?.media || 0);
  const totalEntregasPeriodo = Number(productivityBase.totalEntregasPeriodo || 0);
  const entregasConcluidasPeriodo = Number(productivityBase.entregasConcluidasPeriodo || 0);
  const percentualConclusao =
    totalEntregasPeriodo === 0
      ? 0
      : Number(((entregasConcluidasPeriodo / totalEntregasPeriodo) * 100).toFixed(1));

  return {
    filtro: {
      periodo: filter.periodo,
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
    },
    metricas: {
      totalEntregas: Number(deliveryMetrics.total || 0),
      entregasPendentes: Number(deliveryMetrics.pendentes || 0),
      entregasEmTransito: Number(deliveryMetrics.emTransito || 0),
      entregasEmRota: Number(deliveryMetrics.emRota || 0),
      entregasEntregues: Number(deliveryMetrics.entregues || 0),
      rotasPlanejadas: Number(routeMetrics.planejadas || 0),
      rotasEmAndamento: Number(routeMetrics.emAndamento || 0),
      rotasConcluidas: Number(routeMetrics.concluidas || 0),
      motoristasAtivos: Number(workforceMetrics.motoristasAtivos || 0),
      veiculosDisponiveis: Number(workforceMetrics.veiculosDisponiveis || 0),
      veiculosEmRota: Number(workforceMetrics.veiculosEmRota || 0),
      veiculosEmManutencao: Number(workforceMetrics.veiculosEmManutencao || 0),
      receitaTotalPeriodo: Number(financialMetrics.receitaTotalPeriodo || 0),
      valoresPendentes: Number(financialMetrics.valoresPendentes || 0),
      valoresPagos: Number(financialMetrics.valoresPagos || 0),
      lancamentosVencidos: Number(financialMetrics.lancamentosVencidos || 0),
    },
    alertas: {
      entregasPendentesVencidas: Number(alerts.entregasPendentesVencidas || 0),
      rotasPlanejadasHoje: Number(alerts.rotasPlanejadasHoje || 0),
      veiculosEmManutencao: Number(alerts.veiculosEmManutencao || 0),
      motoristasInativos: Number(alerts.motoristasInativos || 0),
      entregasEntreguesSemComprovante: Number(
        alerts.entregasEntreguesSemComprovante || 0,
      ),
      entregasSemRota: Number(alerts.entregasSemRota || 0),
      rotasEmAndamento: Number(alerts.rotasEmAndamento || 0),
      lancamentosVencidos: Number(alerts.lancamentosVencidos || 0),
    },
    produtividade: {
      entregasConcluidasPeriodo,
      percentualConclusao,
      mediaEntregasPorRota: Number(averagePerRoute.toFixed(2)),
      rotasConcluidasPeriodo: Number(productivityBase.rotasConcluidasPeriodo || 0),
      entregasSemRota: Number(productivityBase.entregasSemRotaAtual || 0),
      totalComprovantesPeriodo: Number(productivityBase.totalComprovantesPeriodo || 0),
      entregasEntreguesSemComprovante: Number(
        productivityBase.entregasEntreguesSemComprovante || 0,
      ),
      receitaTotalPeriodo: Number(financialMetrics.receitaTotalPeriodo || 0),
      valoresPendentes: Number(financialMetrics.valoresPendentes || 0),
      valoresPagos: Number(financialMetrics.valoresPagos || 0),
      lancamentosVencidos: Number(financialMetrics.lancamentosVencidos || 0),
    },
  };
}

module.exports = {
  getOperationalDashboard,
};
