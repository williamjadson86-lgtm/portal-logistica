const ExcelJS = require("exceljs");
const financeRepository = require("../repositories/financeRepository");
const fleetCostRepository = require("../repositories/fleetCostRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateCashFlowFilters,
  validateFinancialStatusUpdate,
} = require("../validations/financialValidation");

function page(_req, res) {
  res.sendFile(resolveView("fluxo-caixa.html"));
}

function ensureValidUuid(id, label) {
  if (!isValidUuid(id)) {
    throw new HttpError(400, `Identificador de ${label} invalido`);
  }
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

function formatPeriodLabel(filters) {
  if (filters.dataInicio && filters.dataFim) {
    return `${filters.dataInicio} ate ${filters.dataFim}`;
  }

  return "Sem periodo informado";
}

function buildRowsCsv(header, rows) {
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function buildCashFlowCsv(report) {
  return buildRowsCsv(
    ["indicador", "valor"],
    [
      ["saldo atual", report.fluxoCaixa.saldoAtual.toFixed(2)],
      ["receitas previstas", report.fluxoCaixa.receitasPrevistas.toFixed(2)],
      ["receitas recebidas", report.fluxoCaixa.receitasRecebidas.toFixed(2)],
      ["despesas previstas", report.fluxoCaixa.despesasPrevistas.toFixed(2)],
      ["despesas pagas", report.fluxoCaixa.despesasPagas.toFixed(2)],
      ["saldo projetado", report.fluxoCaixa.saldoProjetado.toFixed(2)],
      ["periodo", formatPeriodLabel(report.filtros)],
    ],
  );
}

function buildReceivablesCsv(report) {
  return buildRowsCsv(
    ["descricao", "cliente", "entrega", "status", "data vencimento", "data pagamento", "valor"],
    report.contasReceber.itens.map((item) => [
      item.descricao,
      item.cliente?.nome || "",
      item.entrega?.codigo || "",
      item.status,
      item.dataVencimento || item.dataCompetencia || "",
      item.dataPagamento || "",
      item.valor.toFixed(2),
    ]),
  );
}

function buildPayablesCsv(report) {
  return buildRowsCsv(
    ["origem", "descricao", "status", "veiculo", "motorista", "data vencimento", "data pagamento", "valor"],
    report.contasPagar.itens.map((item) => [
      item.origem,
      item.descricao,
      item.status,
      item.veiculo ? `${item.veiculo.placa} - ${item.veiculo.modelo}` : "",
      item.motorista?.nome || "",
      item.dataVencimento || item.dataCompetencia || "",
      item.dataPagamento || "",
      item.valor.toFixed(2),
    ]),
  );
}

function applyWorksheetChrome(worksheet) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  if (worksheet.rowCount > 0) {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
  }
}

function autoSizeColumns(worksheet, minimumWidth = 14) {
  worksheet.columns.forEach((column) => {
    let maxLength = minimumWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, value.length + 2);
    });
    column.width = Math.min(maxLength, 42);
  });
}

function applyCurrencyFormat(worksheet, columns) {
  for (const columnIndex of columns) {
    worksheet.getColumn(columnIndex).numFmt = '"R$" #,##0.00';
  }
}

async function buildWorkbook(report, type) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal Logistica";
  workbook.created = new Date();

  if (type === "cashflow") {
    const worksheet = workbook.addWorksheet("Fluxo de Caixa");
    worksheet.addRow(["Indicador", "Valor"]);
    worksheet.addRows([
      ["Saldo atual", report.fluxoCaixa.saldoAtual],
      ["Receitas previstas", report.fluxoCaixa.receitasPrevistas],
      ["Receitas recebidas", report.fluxoCaixa.receitasRecebidas],
      ["Despesas previstas", report.fluxoCaixa.despesasPrevistas],
      ["Despesas pagas", report.fluxoCaixa.despesasPagas],
      ["Saldo projetado", report.fluxoCaixa.saldoProjetado],
      ["Periodo", formatPeriodLabel(report.filtros)],
    ]);
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [2]);
    autoSizeColumns(worksheet);
  }

  if (type === "receivables") {
    const worksheet = workbook.addWorksheet("Contas a Receber");
    worksheet.addRow(["Descricao", "Cliente", "Entrega", "Status", "Vencimento", "Pagamento", "Valor"]);
    report.contasReceber.itens.forEach((item) => {
      worksheet.addRow([
        item.descricao,
        item.cliente?.nome || "",
        item.entrega?.codigo || "",
        item.status,
        item.dataVencimento || item.dataCompetencia || "",
        item.dataPagamento || "",
        item.valor,
      ]);
    });
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [7]);
    autoSizeColumns(worksheet);
  }

  if (type === "payables") {
    const worksheet = workbook.addWorksheet("Contas a Pagar");
    worksheet.addRow(["Origem", "Descricao", "Status", "Veiculo", "Motorista", "Vencimento", "Pagamento", "Valor"]);
    report.contasPagar.itens.forEach((item) => {
      worksheet.addRow([
        item.origem,
        item.descricao,
        item.status,
        item.veiculo ? `${item.veiculo.placa} - ${item.veiculo.modelo}` : "",
        item.motorista?.nome || "",
        item.dataVencimento || item.dataCompetencia || "",
        item.dataPagamento || "",
        item.valor,
      ]);
    });
    applyWorksheetChrome(worksheet);
    applyCurrencyFormat(worksheet, [8]);
    autoSizeColumns(worksheet);
  }

  return workbook.xlsx.writeBuffer();
}

function buildExportFileName(prefix, filters, extension) {
  const suffix =
    filters.dataInicio && filters.dataFim
      ? `${filters.dataInicio}_${filters.dataFim}`
      : new Date().toISOString().slice(0, 10);

  return `${prefix}_${suffix}.${extension}`;
}

async function getCashFlow(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  res.json(await financeRepository.getCashFlowData(req.user, data));
}

async function markReceivableReceived(req, res) {
  ensureValidUuid(req.params.id, "conta a receber");
  const { errors, data } = validateFinancialStatusUpdate({
    status: "pago",
    dataPagamento: req.body?.dataPagamento,
  });

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const entry = await financeRepository.updateStatusById(req.user, req.params.id, "pago", data.dataPagamento);
  if (!entry) {
    throw new HttpError(404, "Conta a receber nao encontrada");
  }

  res.json({
    mensagem: "Conta a receber marcada como recebida com sucesso",
    lancamento: entry,
  });
}

async function markPayablePaid(req, res) {
  ensureValidUuid(req.params.id, "conta a pagar");
  const { errors, data } = validateFinancialStatusUpdate({
    status: "pago",
    dataPagamento: req.body?.dataPagamento,
  });

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const entry = await financeRepository.updateStatusById(req.user, req.params.id, "pago", data.dataPagamento);
  if (!entry) {
    throw new HttpError(404, "Conta a pagar nao encontrada");
  }

  res.json({
    mensagem: "Conta a pagar marcada como paga com sucesso",
    lancamento: entry,
  });
}

async function markFleetPayablePaid(req, res) {
  ensureValidUuid(req.params.id, "despesa de frota");
  const { errors, data } = validateFinancialStatusUpdate({
    status: "pago",
    dataPagamento: req.body?.dataPagamento,
  });

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const expense = await fleetCostRepository.updateById(req.user, req.params.id, {
    status: "pago",
    dataPagamento: data.dataPagamento,
  });
  if (!expense) {
    throw new HttpError(404, "Despesa de frota nao encontrada");
  }

  res.json({
    mensagem: "Despesa de frota marcada como paga com sucesso",
    despesa: expense,
  });
}

async function exportCashFlowCsv(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await financeRepository.getCashFlowData(req.user, data);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${buildExportFileName("fluxo_caixa", data, "csv")}"`,
  );
  res.status(200).send(buildCashFlowCsv(report));
}

async function exportCashFlowXlsx(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await financeRepository.getCashFlowData(req.user, data);
  const buffer = await buildWorkbook(report, "cashflow");
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${buildExportFileName("fluxo_caixa", data, "xlsx")}"`,
  );
  res.status(200).send(Buffer.from(buffer));
}

async function exportReceivablesCsv(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await financeRepository.getCashFlowData(req.user, data);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${buildExportFileName("contas_receber", data, "csv")}"`,
  );
  res.status(200).send(buildReceivablesCsv(report));
}

async function exportReceivablesXlsx(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await financeRepository.getCashFlowData(req.user, data);
  const buffer = await buildWorkbook(report, "receivables");
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${buildExportFileName("contas_receber", data, "xlsx")}"`,
  );
  res.status(200).send(Buffer.from(buffer));
}

async function exportPayablesCsv(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await financeRepository.getCashFlowData(req.user, data);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${buildExportFileName("contas_pagar", data, "csv")}"`,
  );
  res.status(200).send(buildPayablesCsv(report));
}

async function exportPayablesXlsx(req, res) {
  const { errors, data } = validateCashFlowFilters(req.query);
  if (errors.length > 0) {
    throw new HttpError(400, "Filtros invalidos", errors);
  }

  const report = await financeRepository.getCashFlowData(req.user, data);
  const buffer = await buildWorkbook(report, "payables");
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${buildExportFileName("contas_pagar", data, "xlsx")}"`,
  );
  res.status(200).send(Buffer.from(buffer));
}

module.exports = {
  page,
  getCashFlow,
  markReceivableReceived,
  markPayablePaid,
  markFleetPayablePaid,
  exportCashFlowCsv,
  exportCashFlowXlsx,
  exportReceivablesCsv,
  exportReceivablesXlsx,
  exportPayablesCsv,
  exportPayablesXlsx,
};
