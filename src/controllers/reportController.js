const ExcelJS = require("exceljs");
const reportRepository = require("../repositories/reportRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const { isValidUuid } = require("../validations/deliveryValidation");
const {
  validateClientReportFilters,
  validateCommonReportFilters,
  validateReportExport,
} = require("../validations/reportValidation");

function page(_req, res) {
  res.sendFile(resolveView("relatorios.html"));
}

function escapeCsvCell(value) {
  if (value == null) {
    return "";
  }

  const normalized = String(value).replace(/\r?\n/g, " ");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildRowsCsv(header, rows) {
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function formatPeriodLabel(filters) {
  if (filters.dataInicio && filters.dataFim) {
    return `${filters.dataInicio} ate ${filters.dataFim}`;
  }

  return "Sem periodo informado";
}

function applyWorksheetChrome(worksheet) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  if (worksheet.rowCount > 0) {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
  }
}

function autoSizeColumns(worksheet, minimumWidth = 14) {
  worksheet.columns.forEach((column) => {
    let maxLength = minimumWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, value.length + 2);
    });
    column.width = Math.min(maxLength, 40);
  });
}

function applyCurrencyFormat(worksheet, columns) {
  for (const columnIndex of columns) {
    worksheet.getColumn(columnIndex).numFmt = '"R$" #,##0.00';
  }
}

function buildOverallSummary(items) {
  return items.reduce(
    (summary, item) => ({
      totalClientes: summary.totalClientes + 1,
      totalEntregas: summary.totalEntregas + item.totalEntregas,
      totalComprovantes: summary.totalComprovantes + item.totalComprovantes,
      receitaTotal: Number((summary.receitaTotal + item.receitaTotal).toFixed(2)),
      valorPendente: Number((summary.valorPendente + item.valorPendente).toFixed(2)),
      valorPago: Number((summary.valorPago + item.valorPago).toFixed(2)),
      lancamentosVencidos: summary.lancamentosVencidos + item.lancamentosVencidos,
    }),
    {
      totalClientes: 0,
      totalEntregas: 0,
      totalComprovantes: 0,
      receitaTotal: 0,
      valorPendente: 0,
      valorPago: 0,
      lancamentosVencidos: 0,
    },
  );
}

function buildRankings(items) {
  const source = Array.isArray(items) ? [...items] : [];
  const sortBy = (selector) =>
    [...source]
      .sort((left, right) => selector(right) - selector(left))
      .slice(0, 5);

  return {
    topReceita: sortBy((item) => item.receitaTotal),
    topVolumeEntregas: sortBy((item) => item.totalEntregas),
    topValorPendente: sortBy((item) => item.valorPendente),
    clientesComLancamentosVencidos: source
      .filter((item) => item.lancamentosVencidos > 0)
      .sort((left, right) => right.lancamentosVencidos - left.lancamentosVencidos),
  };
}

function buildClientsCsv(items) {
  return buildRowsCsv(
    [
      "cliente",
      "documento",
      "total de entregas",
      "entregas pendentes",
      "entregas em rota",
      "entregas entregues",
      "entregas canceladas",
      "total de comprovantes",
      "receita total",
      "valor pendente",
      "valor pago",
      "lancamentos vencidos",
      "ticket medio",
    ],
    items.map((item) => [
      item.nome,
      item.documento,
      item.totalEntregas,
      item.entregasPendentes,
      item.entregasEmRota,
      item.entregasEntregues,
      item.entregasCanceladas,
      item.totalComprovantes,
      item.receitaTotal.toFixed(2),
      item.valorPendente.toFixed(2),
      item.valorPago.toFixed(2),
      item.lancamentosVencidos,
      item.ticketMedioPorEntrega.toFixed(2),
    ]),
  );
}

function buildDeliveriesCsv(report) {
  return buildRowsCsv(
    ["codigo", "cliente", "cidade", "estado", "status", "data prevista", "valor frete"],
    report.entregas.map((item) => [
      item.codigo,
      item.cliente,
      item.cidade,
      item.estado,
      item.status,
      item.dataPrevista || "",
      item.valorFrete != null ? Number(item.valorFrete).toFixed(2) : "",
    ]),
  );
}

function buildFinancialCsv(report) {
  return buildRowsCsv(
    ["descricao", "tipo", "status", "cliente", "entrega", "competencia", "vencimento", "pagamento", "valor"],
    report.lancamentos.map((item) => [
      item.descricao,
      item.tipo,
      item.status,
      item.cliente?.nome || "",
      item.entrega?.codigo || "",
      item.dataCompetencia || "",
      item.dataVencimento || "",
      item.dataPagamento || "",
      item.valor.toFixed(2),
    ]),
  );
}

function buildFleetCostsCsv(report) {
  const header = [
    "categoria",
    "identificador",
    "descricao",
    "total de entregas",
    "receita total",
    "despesa total",
    "resultado liquido",
    "margem",
  ];

  const vehicleRows = report.veiculos.map((item) => [
    "veiculo",
    item.placa,
    item.modelo,
    item.totalEntregas,
    item.receitaTotal.toFixed(2),
    item.despesaTotal.toFixed(2),
    item.lucro.toFixed(2),
    `${item.margem.toFixed(2)}%`,
  ]);
  const driverRows = report.motoristas.map((item) => [
    "motorista",
    item.nome,
    item.status,
    item.totalEntregas,
    item.receitaTotal.toFixed(2),
    item.despesaTotal.toFixed(2),
    item.lucro.toFixed(2),
    `${item.margem.toFixed(2)}%`,
  ]);

  return buildRowsCsv(header, [...vehicleRows, ...driverRows]);
}

function buildSummaryCsv(report) {
  return buildRowsCsv(
    ["indicador", "valor"],
    [
      ["periodo", formatPeriodLabel(report.filtros)],
      ["total entregas", report.resumo.totalEntregas],
      ["receita total", report.resumo.receitaTotal.toFixed(2)],
      ["despesa total", report.resumo.despesaTotal.toFixed(2)],
      ["resultado financeiro", report.resumo.resultadoFinanceiro.toFixed(2)],
    ],
  );
}

async function buildWorkbookForType(type, report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal Logistica";
  workbook.created = new Date();

  if (type === "resumo") {
    const worksheet = workbook.addWorksheet("Resumo");
    worksheet.addRow(["Indicador", "Valor"]);
    worksheet.addRows([
      ["Periodo", formatPeriodLabel(report.filtros)],
      ["Total de entregas", report.resumo.totalEntregas],
      ["Receita total", report.resumo.receitaTotal],
      ["Despesa total", report.resumo.despesaTotal],
      ["Resultado financeiro", report.resumo.resultadoFinanceiro],
    ]);
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [2]);
    autoSizeColumns(worksheet);
  }

  if (type === "entregas") {
    const worksheet = workbook.addWorksheet("Entregas");
    worksheet.addRow(["Codigo", "Cliente", "Cidade", "Estado", "Status", "Data prevista", "Valor frete"]);
    report.entregas.forEach((item) => {
      worksheet.addRow([
        item.codigo,
        item.cliente,
        item.cidade,
        item.estado,
        item.status,
        item.dataPrevista || "",
        item.valorFrete != null ? Number(item.valorFrete) : null,
      ]);
    });
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [7]);
    autoSizeColumns(worksheet);
  }

  if (type === "financeiro") {
    const worksheet = workbook.addWorksheet("Financeiro");
    worksheet.addRow([
      "Descricao",
      "Tipo",
      "Status",
      "Cliente",
      "Entrega",
      "Competencia",
      "Vencimento",
      "Pagamento",
      "Valor",
    ]);
    report.lancamentos.forEach((item) => {
      worksheet.addRow([
        item.descricao,
        item.tipo,
        item.status,
        item.cliente?.nome || "",
        item.entrega?.codigo || "",
        item.dataCompetencia || "",
        item.dataVencimento || "",
        item.dataPagamento || "",
        item.valor,
      ]);
    });
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [9]);
    autoSizeColumns(worksheet);
  }

  if (type === "frota") {
    const worksheet = workbook.addWorksheet("Frota");
    worksheet.addRow([
      "Veiculo",
      "Modelo",
      "Entregas",
      "Receita total",
      "Despesa total",
      "Resultado liquido",
      "Margem",
      "Manutencoes",
      "Custo manutencao",
    ]);
    report.veiculos.forEach((item) => {
      worksheet.addRow([
        item.placa,
        item.modelo,
        item.totalEntregas,
        item.receitaTotal,
        item.despesaTotal,
        item.lucro,
        item.margem / 100,
        item.totalManutencoes || 0,
        item.custoManutencao || 0,
      ]);
    });
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [4, 5, 6, 9]);
    worksheet.getColumn(7).numFmt = "0.00%";
    autoSizeColumns(worksheet);
  }

  return workbook.xlsx.writeBuffer();
}

async function loadClientReport(userId, filters) {
  const report = await reportRepository.listByClient(userId, filters);

  return {
    filtros: filters,
    resumo: buildOverallSummary(report.clientes),
    ranking: buildRankings(report.clientes),
    clientes: report.clientes,
    apoio: report.apoio,
  };
}

async function loadFleetCostReport(userId, filters) {
  return reportRepository.getFleetCostReport(userId, filters);
}

async function loadSummaryReport(userId, filters) {
  return reportRepository.getSummaryReport(userId, filters);
}

async function loadDeliveriesReport(userId, filters) {
  return reportRepository.getDeliveriesReport(userId, filters);
}

async function loadFinancialReport(userId, filters) {
  return reportRepository.getFinancialReport(userId, filters);
}

async function loadFleetReport(userId, filters) {
  return reportRepository.getFleetReport(userId, filters);
}

async function listByClient(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadClientReport(req.user, data));
}

async function getSummary(req, res) {
  const { errors, data } = validateCommonReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadSummaryReport(req.user, data));
}

async function getDeliveries(req, res) {
  const { errors, data } = validateCommonReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadDeliveriesReport(req.user, data));
}

async function getFinancial(req, res) {
  const { errors, data } = validateCommonReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadFinancialReport(req.user, data));
}

async function getFleet(req, res) {
  const { errors, data } = validateCommonReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadFleetReport(req.user, data));
}

async function exportGeneric(req, res) {
  const { errors, data } = validateReportExport(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const loaders = {
    resumo: loadSummaryReport,
    entregas: loadDeliveriesReport,
    financeiro: loadFinancialReport,
    frota: loadFleetReport,
  };
  const csvBuilders = {
    resumo: buildSummaryCsv,
    entregas: buildDeliveriesCsv,
    financeiro: buildFinancialCsv,
    frota: buildFleetCostsCsv,
  };

  const report = await loaders[data.tipoExportacao](req.user, data);

  if (data.formato === "csv") {
    const csv = csvBuilders[data.tipoExportacao](report);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="relatorios_${data.tipoExportacao}.csv"`,
    );
    res.status(200).send(csv);
    return;
  }

  const buffer = await buildWorkbookForType(data.tipoExportacao, report);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="relatorios_${data.tipoExportacao}.xlsx"`,
  );
  res.status(200).send(Buffer.from(buffer));
}

async function exportClientsCsv(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await loadClientReport(req.user, data);
  const csv = buildClientsCsv(report.clientes);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="relatorios_clientes.csv"');
  res.status(200).send(csv);
}

async function exportClientsXlsx(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await loadClientReport(req.user, data);
  const buffer = await buildWorkbookForType("financeiro", {
    lancamentos: report.clientes.map((item) => ({
      descricao: item.nome,
      tipo: "receita",
      status: "pago",
      cliente: { nome: item.nome },
      entrega: null,
      dataCompetencia: data.dataInicio,
      dataVencimento: data.dataFim,
      dataPagamento: data.dataFim,
      valor: item.receitaTotal,
    })),
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="relatorios_clientes.xlsx"');
  res.status(200).send(Buffer.from(buffer));
}

async function exportFleetCostsCsv(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await loadFleetCostReport(req.user, data);
  const csv = buildFleetCostsCsv(report);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="relatorios_frota.csv"');
  res.status(200).send(csv);
}

async function exportFleetCostsXlsx(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await loadFleetCostReport(req.user, data);
  const buffer = await buildWorkbookForType("frota", report);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="relatorios_frota.xlsx"');
  res.status(200).send(Buffer.from(buffer));
}

async function showClientDetail(req, res) {
  if (!isValidUuid(req.params.id)) {
    throw new HttpError(400, "Identificador de cliente invalido");
  }

  const detail = await reportRepository.getClientReportDetails(req.user, req.params.id);
  if (!detail) {
    throw new HttpError(404, "Cliente nao encontrado");
  }

  res.json(detail);
}

async function getFleetCostsReport(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadFleetCostReport(req.user, data));
}

module.exports = {
  page,
  listByClient,
  showClientDetail,
  buildOverallSummary,
  buildRankings,
  buildClientsCsv,
  buildFleetCostsCsv,
  exportClientsCsv,
  exportClientsXlsx,
  exportFleetCostsCsv,
  exportFleetCostsXlsx,
  getFleetCostsReport,
  getSummary,
  getDeliveries,
  getFinancial,
  getFleet,
  exportGeneric,
};
