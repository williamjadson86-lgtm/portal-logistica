const ExcelJS = require("exceljs");
const reportRepository = require("../repositories/reportRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const { isValidUuid } = require("../validations/deliveryValidation");
const { validateClientReportFilters } = require("../validations/reportValidation");

function page(_req, res) {
  res.sendFile(resolveView("relatorios.html"));
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

function buildGeneralAverageTicket(summary) {
  if (!summary.totalEntregas) {
    return 0;
  }

  return Number((summary.receitaTotal / summary.totalEntregas).toFixed(2));
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

function buildClientsCsv(items) {
  const header = [
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
  ];

  const rows = items.map((item) => [
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
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function buildExportFileName(filters) {
  const suffix =
    filters.dataInicio && filters.dataFim
      ? `${filters.dataInicio}_${filters.dataFim}`
      : new Date().toISOString().slice(0, 10);

  return `relatorios_clientes_${suffix}.csv`;
}

function buildExportXlsxFileName(filters) {
  const suffix =
    filters.dataInicio && filters.dataFim
      ? `${filters.dataInicio}_${filters.dataFim}`
      : new Date().toISOString().slice(0, 10);

  return `relatorios_clientes_${suffix}.xlsx`;
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

  if (worksheet.rowCount > 0 && worksheet.columnCount > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columnCount },
    };
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

function applyDateFormat(worksheet, columns) {
  for (const columnIndex of columns) {
    worksheet.getColumn(columnIndex).numFmt = "dd/mm/yyyy";
  }
}

function parseExcelDate(value) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

function createSummaryWorksheet(workbook, report) {
  const worksheet = workbook.addWorksheet("Resumo");
  worksheet.addRow(["Indicador", "Valor"]);
  worksheet.addRows([
    ["Periodo aplicado", formatPeriodLabel(report.filtros)],
    ["Data inicial", parseExcelDate(report.filtros.dataInicio) || "Nao informada"],
    ["Data final", parseExcelDate(report.filtros.dataFim) || "Nao informada"],
    ["Total de clientes", report.resumo.totalClientes],
    ["Receita total", report.resumo.receitaTotal],
    ["Valor pendente", report.resumo.valorPendente],
    ["Valor pago", report.resumo.valorPago],
    ["Lancamentos vencidos", report.resumo.lancamentosVencidos],
    ["Total de entregas", report.resumo.totalEntregas],
    ["Ticket medio geral", buildGeneralAverageTicket(report.resumo)],
  ]);

  applyWorksheetChrome(worksheet);
  worksheet.getCell("B3").numFmt = "dd/mm/yyyy";
  worksheet.getCell("B4").numFmt = "dd/mm/yyyy";
  worksheet.getCell("B6").numFmt = '"R$" #,##0.00';
  worksheet.getCell("B7").numFmt = '"R$" #,##0.00';
  worksheet.getCell("B8").numFmt = '"R$" #,##0.00';
  worksheet.getCell("B11").numFmt = '"R$" #,##0.00';
  autoSizeColumns(worksheet);
}

function createClientsWorksheet(workbook, report) {
  const worksheet = workbook.addWorksheet("Clientes");
  worksheet.addRow([
    "Cliente",
    "Documento",
    "Total de entregas",
    "Pendentes",
    "Em rota",
    "Entregues",
    "Canceladas",
    "Total de comprovantes",
    "Receita total",
    "Valor pendente",
    "Valor pago",
    "Lancamentos vencidos",
    "Ticket medio",
  ]);

  report.clientes.forEach((item) => {
    worksheet.addRow([
      item.nome,
      item.documento,
      item.totalEntregas,
      item.entregasPendentes,
      item.entregasEmRota,
      item.entregasEntregues,
      item.entregasCanceladas,
      item.totalComprovantes,
      item.receitaTotal,
      item.valorPendente,
      item.valorPago,
      item.lancamentosVencidos,
      item.ticketMedioPorEntrega,
    ]);
  });

  applyWorksheetChrome(worksheet);
  applyCurrencyFormat(worksheet, [9, 10, 11, 13]);
  autoSizeColumns(worksheet);
}

function createSimpleRankingWorksheet(workbook, name, title, items, valueKey, formatter = null) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.addRow(["Posicao", "Cliente", title]);

  items.forEach((item, index) => {
    worksheet.addRow([
      index + 1,
      item.nome,
      formatter ? formatter(item[valueKey]) : item[valueKey],
    ]);
  });

  applyWorksheetChrome(worksheet);
  autoSizeColumns(worksheet);
  return worksheet;
}

function createPendingWorksheet(workbook, report) {
  const worksheet = workbook.addWorksheet("Pendencias");
  worksheet.addRow(["Cliente", "Valor pendente", "Lancamentos vencidos"]);

  report.ranking.clientesComLancamentosVencidos.forEach((item) => {
    worksheet.addRow([item.nome, item.valorPendente, item.lancamentosVencidos]);
  });

  applyWorksheetChrome(worksheet);
  applyCurrencyFormat(worksheet, [2]);
  autoSizeColumns(worksheet);
}

async function buildClientsWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal Logistica";
  workbook.created = new Date();
  workbook.modified = new Date();

  createSummaryWorksheet(workbook, report);
  createClientsWorksheet(workbook, report);
  const receitaWorksheet = createSimpleRankingWorksheet(
    workbook,
    "Ranking Receita",
    "Receita total",
    report.ranking.topReceita,
    "receitaTotal",
  );
  applyCurrencyFormat(receitaWorksheet, [3]);

  createSimpleRankingWorksheet(
    workbook,
    "Ranking Volume",
    "Total de entregas",
    report.ranking.topVolumeEntregas,
    "totalEntregas",
  );
  createPendingWorksheet(workbook, report);

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

async function listByClient(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await loadClientReport(req.user.id, data));
}

async function exportClientsCsv(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await loadClientReport(req.user.id, data);
  const csv = buildClientsCsv(report.clientes);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${buildExportFileName(data)}"`);
  res.status(200).send(csv);
}

async function exportClientsXlsx(req, res) {
  const { errors, data } = validateClientReportFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await loadClientReport(req.user.id, data);
  const buffer = await buildClientsWorkbook(report);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${buildExportXlsxFileName(data)}"`);
  res.status(200).send(Buffer.from(buffer));
}

async function showClientDetail(req, res) {
  if (!isValidUuid(req.params.id)) {
    throw new HttpError(400, "Identificador de cliente invalido");
  }

  const detail = await reportRepository.getClientReportDetails(req.user.id, req.params.id);
  if (!detail) {
    throw new HttpError(404, "Cliente nao encontrado");
  }

  res.json(detail);
}

module.exports = {
  page,
  listByClient,
  showClientDetail,
  buildOverallSummary,
  buildRankings,
  buildClientsCsv,
  buildClientsWorkbook,
  exportClientsCsv,
  exportClientsXlsx,
};
