const database = require("../config/database");

function mapClientFilter(row) {
  return {
    id: row.id,
    nome: row.nome,
    documento: row.documento,
    status: row.status,
  };
}

function mapClientReportRow(row) {
  return {
    clienteId: row.clienteId,
    nome: row.nome,
    documento: row.documento,
    status: row.status,
    totalEntregas: Number(row.totalEntregas || 0),
    entregasPendentes: Number(row.entregasPendentes || 0),
    entregasEmRota: Number(row.entregasEmRota || 0),
    entregasEntregues: Number(row.entregasEntregues || 0),
    entregasCanceladas: Number(row.entregasCanceladas || 0),
    totalRotasVinculadas: Number(row.totalRotasVinculadas || 0),
    totalComprovantes: Number(row.totalComprovantes || 0),
    receitaTotal: Number(row.receitaTotal || 0),
    valorPendente: Number(row.valorPendente || 0),
    valorPago: Number(row.valorPago || 0),
    lancamentosVencidos: Number(row.lancamentosVencidos || 0),
    ticketMedioPorEntrega: Number(row.ticketMedioPorEntrega || 0),
  };
}

function mapDeliveryRow(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    clienteId: row.clienteId || null,
    cliente: row.cliente,
    status: row.status,
    origem: row.origem,
    destino: row.destino,
    cidade: row.cidade,
    estado: row.estado,
    dataPrevista: row.dataPrevista,
    valorFrete: row.valorFrete != null ? Number(row.valorFrete) : null,
    rotaAtual: row.rotaId
      ? {
          id: row.rotaId,
          codigo: row.rotaCodigo,
          status: row.rotaStatus,
        }
      : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function mapFinancialRow(row) {
  return {
    id: row.id,
    clienteId: row.clienteId || null,
    entregaId: row.entregaId || null,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: Number(row.valor || 0),
    status: row.status,
    dataCompetencia: row.dataCompetencia,
    dataVencimento: row.dataVencimento,
    dataPagamento: row.dataPagamento,
    entrega: row.entregaId
      ? {
          id: row.entregaId,
          codigo: row.entregaCodigo,
          cliente: row.entregaCliente,
        }
      : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function mapProofRow(row) {
  return {
    id: row.id,
    entregaId: row.entregaId,
    codigoEntrega: row.codigoEntrega,
    cliente: row.cliente,
    tipo: row.tipo,
    arquivoNome: row.arquivoNome,
    mimeType: row.mimeType,
    tamanhoBytes: row.tamanhoBytes != null ? Number(row.tamanhoBytes) : null,
    observacao: row.observacao || "",
    ativo: row.ativo,
    criadoEm: row.criadoEm,
  };
}

async function listClientFilters(userId) {
  const result = await database.query(
    `SELECT id, nome, documento, status
    FROM clientes
    WHERE usuario_id = $1
    ORDER BY nome ASC`,
    [userId],
  );

  return result.rows.map(mapClientFilter);
}

async function listByClient(userId, filters) {
  const values = [
    userId,
    filters.clienteId || null,
    filters.dataInicio || null,
    filters.dataFim || null,
    filters.statusEntrega || null,
    filters.statusFinanceiro || null,
  ];

  const [clientsResult, reportsResult] = await Promise.all([
    listClientFilters(userId),
    database.query(
      `WITH selected_clients AS (
        SELECT c.id, c.nome, c.documento, c.status
        FROM clientes c
        WHERE c.usuario_id = $1
          AND ($2::uuid IS NULL OR c.id = $2::uuid)
      ),
      delivery_metrics AS (
        SELECT
          c.id AS "clienteId",
          COUNT(DISTINCT d.id)::int AS "totalEntregas",
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'pendente')::int AS "entregasPendentes",
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'em_rota')::int AS "entregasEmRota",
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'entregue')::int AS "entregasEntregues",
          COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'cancelada')::int AS "entregasCanceladas",
          COUNT(DISTINCT re.rota_id)::int AS "totalRotasVinculadas",
          COUNT(DISTINCT cp.id) FILTER (WHERE cp.ativo = TRUE)::int AS "totalComprovantes"
        FROM selected_clients c
        LEFT JOIN entregas d
          ON d.usuario_id = $1
          AND d.cliente_id = c.id
          AND ($3::date IS NULL OR COALESCE(d.previsao_entrega, d.criado_em::date) >= $3::date)
          AND ($4::date IS NULL OR COALESCE(d.previsao_entrega, d.criado_em::date) <= $4::date)
          AND ($5::text IS NULL OR d.status = $5::text)
        LEFT JOIN rota_entregas re
          ON re.entrega_id = d.id
        LEFT JOIN comprovantes cp
          ON cp.entrega_id = d.id
        GROUP BY c.id
      ),
      financial_base AS (
        SELECT
          lf.id,
          lf.tipo,
          lf.valor,
          lf.status,
          lf.data_vencimento,
          lf.data_competencia,
          COALESCE(lf.cliente_id, d.cliente_id) AS effective_cliente_id
        FROM lancamentos_financeiros lf
        LEFT JOIN entregas d
          ON d.id = lf.entrega_id
          AND d.usuario_id = $1
        WHERE lf.usuario_id = $1
      ),
      financial_metrics AS (
        SELECT
          c.id AS "clienteId",
          COALESCE(SUM(fb.valor) FILTER (
            WHERE fb.tipo = 'receita'
              AND fb.status <> 'cancelado'
          ), 0)::numeric(12, 2) AS "receitaTotal",
          COALESCE(SUM(fb.valor) FILTER (
            WHERE fb.status IN ('pendente', 'faturado')
          ), 0)::numeric(12, 2) AS "valorPendente",
          COALESCE(SUM(fb.valor) FILTER (
            WHERE fb.status = 'pago'
          ), 0)::numeric(12, 2) AS "valorPago",
          COUNT(DISTINCT fb.id) FILTER (
            WHERE fb.status IN ('pendente', 'faturado')
              AND fb.data_vencimento IS NOT NULL
              AND fb.data_vencimento < CURRENT_DATE
          )::int AS "lancamentosVencidos"
        FROM selected_clients c
        LEFT JOIN financial_base fb
          ON fb.effective_cliente_id = c.id
          AND ($3::date IS NULL OR fb.data_competencia >= $3::date)
          AND ($4::date IS NULL OR fb.data_competencia <= $4::date)
          AND ($6::text IS NULL OR fb.status = $6::text)
        GROUP BY c.id
      )
      SELECT
        c.id AS "clienteId",
        c.nome,
        c.documento,
        c.status,
        COALESCE(dm."totalEntregas", 0) AS "totalEntregas",
        COALESCE(dm."entregasPendentes", 0) AS "entregasPendentes",
        COALESCE(dm."entregasEmRota", 0) AS "entregasEmRota",
        COALESCE(dm."entregasEntregues", 0) AS "entregasEntregues",
        COALESCE(dm."entregasCanceladas", 0) AS "entregasCanceladas",
        COALESCE(dm."totalRotasVinculadas", 0) AS "totalRotasVinculadas",
        COALESCE(dm."totalComprovantes", 0) AS "totalComprovantes",
        COALESCE(fm."receitaTotal", 0) AS "receitaTotal",
        COALESCE(fm."valorPendente", 0) AS "valorPendente",
        COALESCE(fm."valorPago", 0) AS "valorPago",
        COALESCE(fm."lancamentosVencidos", 0) AS "lancamentosVencidos",
        CASE
          WHEN COALESCE(dm."totalEntregas", 0) = 0 THEN 0::numeric(12, 2)
          ELSE ROUND(COALESCE(fm."receitaTotal", 0) / dm."totalEntregas", 2)
        END AS "ticketMedioPorEntrega"
      FROM selected_clients c
      LEFT JOIN delivery_metrics dm
        ON dm."clienteId" = c.id
      LEFT JOIN financial_metrics fm
        ON fm."clienteId" = c.id
      ORDER BY c.nome ASC`,
      values,
    ),
  ]);

  return {
    clientes: reportsResult.rows.map(mapClientReportRow),
    apoio: {
      clientes: clientsResult,
    },
  };
}

async function findClientDetailById(userId, clientId) {
  const clientResult = await database.query(
    `SELECT
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM clientes
    WHERE usuario_id = $1 AND id = $2`,
    [userId, clientId],
  );

  return clientResult.rows[0] || null;
}

async function getOperationalSummary(userId, clientId) {
  const result = await database.query(
    `SELECT
      COUNT(DISTINCT d.id)::int AS "totalEntregas",
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'pendente')::int AS "entregasPendentes",
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'em_rota')::int AS "entregasEmRota",
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'entregue')::int AS "entregasEntregues",
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'cancelada')::int AS "entregasCanceladas",
      COUNT(DISTINCT re.rota_id)::int AS "totalRotasVinculadas",
      COUNT(DISTINCT cp.id) FILTER (WHERE cp.ativo = TRUE)::int AS "totalComprovantes"
    FROM entregas d
    LEFT JOIN rota_entregas re
      ON re.entrega_id = d.id
    LEFT JOIN comprovantes cp
      ON cp.entrega_id = d.id
    WHERE d.usuario_id = $1
      AND d.cliente_id = $2`,
    [userId, clientId],
  );

  return {
    totalEntregas: Number(result.rows[0].totalEntregas || 0),
    entregasPendentes: Number(result.rows[0].entregasPendentes || 0),
    entregasEmRota: Number(result.rows[0].entregasEmRota || 0),
    entregasEntregues: Number(result.rows[0].entregasEntregues || 0),
    entregasCanceladas: Number(result.rows[0].entregasCanceladas || 0),
    totalRotasVinculadas: Number(result.rows[0].totalRotasVinculadas || 0),
    totalComprovantes: Number(result.rows[0].totalComprovantes || 0),
  };
}

async function getFinancialSummary(userId, clientId) {
  const result = await database.query(
    `WITH financial_base AS (
      SELECT
        lf.id,
        lf.tipo,
        lf.valor,
        lf.status,
        lf.data_vencimento,
        COALESCE(lf.cliente_id, d.cliente_id) AS effective_cliente_id
      FROM lancamentos_financeiros lf
      LEFT JOIN entregas d
        ON d.id = lf.entrega_id
        AND d.usuario_id = $1
      WHERE lf.usuario_id = $1
    )
    SELECT
      COALESCE(SUM(valor) FILTER (
        WHERE tipo = 'receita'
          AND status <> 'cancelado'
      ), 0)::numeric(12, 2) AS "receitaTotal",
      COALESCE(SUM(valor) FILTER (
        WHERE status IN ('pendente', 'faturado')
      ), 0)::numeric(12, 2) AS "valorPendente",
      COALESCE(SUM(valor) FILTER (
        WHERE status = 'pago'
      ), 0)::numeric(12, 2) AS "valorPago",
      COUNT(DISTINCT id) FILTER (
        WHERE status IN ('pendente', 'faturado')
          AND data_vencimento IS NOT NULL
          AND data_vencimento < CURRENT_DATE
      )::int AS "lancamentosVencidos"
    FROM financial_base
    WHERE effective_cliente_id = $2`,
    [userId, clientId],
  );

  return {
    receitaTotal: Number(result.rows[0].receitaTotal || 0),
    valorPendente: Number(result.rows[0].valorPendente || 0),
    valorPago: Number(result.rows[0].valorPago || 0),
    lancamentosVencidos: Number(result.rows[0].lancamentosVencidos || 0),
  };
}

async function listRecentDeliveries(userId, clientId) {
  const result = await database.query(
    `SELECT
      d.id,
      d.codigo,
      d.cliente_id AS "clienteId",
      d.cliente,
      d.status,
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      d.valor_frete AS "valorFrete",
      r.id AS "rotaId",
      r.codigo AS "rotaCodigo",
      r.status AS "rotaStatus",
      d.criado_em AS "criadoEm",
      d.atualizado_em AS "atualizadoEm"
    FROM entregas d
    LEFT JOIN rota_entregas re
      ON re.entrega_id = d.id
      AND re.ativo = TRUE
    LEFT JOIN rotas_operacionais r
      ON r.id = re.rota_id
    WHERE d.usuario_id = $1
      AND d.cliente_id = $2
    ORDER BY COALESCE(d.previsao_entrega, d.criado_em::date) DESC, d.criado_em DESC
    LIMIT 10`,
    [userId, clientId],
  );

  return result.rows.map(mapDeliveryRow);
}

async function listRecentFinancialEntries(userId, clientId) {
  const result = await database.query(
    `WITH financial_base AS (
      SELECT
        lf.id,
        lf.cliente_id AS "clienteId",
        lf.entrega_id AS "entregaId",
        lf.tipo,
        lf.descricao,
        lf.valor,
        lf.status,
        TO_CHAR(lf.data_competencia, 'YYYY-MM-DD') AS "dataCompetencia",
        TO_CHAR(lf.data_vencimento, 'YYYY-MM-DD') AS "dataVencimento",
        TO_CHAR(lf.data_pagamento, 'YYYY-MM-DD') AS "dataPagamento",
        lf.criado_em AS "criadoEm",
        lf.atualizado_em AS "atualizadoEm",
        e.codigo AS "entregaCodigo",
        COALESCE(dc.nome, e.cliente) AS "entregaCliente",
        COALESCE(lf.cliente_id, e.cliente_id) AS effective_cliente_id
      FROM lancamentos_financeiros lf
      LEFT JOIN entregas e
        ON e.id = lf.entrega_id
        AND e.usuario_id = $1
      LEFT JOIN clientes dc
        ON dc.id = e.cliente_id
      WHERE lf.usuario_id = $1
    )
    SELECT *
    FROM financial_base
    WHERE effective_cliente_id = $2
    ORDER BY "dataCompetencia" DESC NULLS LAST, "criadoEm" DESC
    LIMIT 10`,
    [userId, clientId],
  );

  return result.rows.map(mapFinancialRow);
}

async function listProofsByClient(userId, clientId) {
  const result = await database.query(
    `SELECT
      cp.id,
      cp.entrega_id AS "entregaId",
      d.codigo AS "codigoEntrega",
      d.cliente,
      cp.tipo,
      cp.arquivo_nome AS "arquivoNome",
      cp.mime_type AS "mimeType",
      cp.tamanho_bytes AS "tamanhoBytes",
      cp.observacao,
      cp.ativo,
      cp.criado_em AS "criadoEm"
    FROM comprovantes cp
    INNER JOIN entregas d
      ON d.id = cp.entrega_id
    WHERE d.usuario_id = $1
      AND d.cliente_id = $2
    ORDER BY cp.criado_em DESC
    LIMIT 20`,
    [userId, clientId],
  );

  return result.rows.map(mapProofRow);
}

async function getClientReportDetails(userId, clientId) {
  const client = await findClientDetailById(userId, clientId);
  if (!client) {
    return null;
  }

  const [
    resumoOperacional,
    resumoFinanceiro,
    entregasRecentes,
    lancamentosRecentes,
    comprovantes,
  ] = await Promise.all([
    getOperationalSummary(userId, clientId),
    getFinancialSummary(userId, clientId),
    listRecentDeliveries(userId, clientId),
    listRecentFinancialEntries(userId, clientId),
    listProofsByClient(userId, clientId),
  ]);

  return {
    cliente: client,
    resumoOperacional,
    resumoFinanceiro,
    entregasRecentes,
    lancamentosRecentes,
    comprovantes,
  };
}

module.exports = {
  listByClient,
  getClientReportDetails,
};
