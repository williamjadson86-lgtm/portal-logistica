function createCashFlowApp() {
  const root = document.querySelector("[data-cash-flow-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, formatCurrency, createStatusLabel } =
    window.portalUtils;
  const message = document.querySelector("[data-cash-flow-message]");
  const filterForm = document.querySelector("[data-cash-flow-filter-form]");
  const periodSelect = document.querySelector("[data-cash-flow-period]");
  const customRange = document.querySelector("[data-cash-flow-custom-range]");
  const refreshButton = document.querySelector("[data-cash-flow-refresh-button]");
  const exportButton = document.querySelector("[data-cash-flow-export-button]");
  const exportExcelButton = document.querySelector("[data-cash-flow-export-excel-button]");
  const receivablesExportButton = document.querySelector(
    "[data-cash-flow-receivables-export-button]",
  );
  const receivablesExportExcelButton = document.querySelector(
    "[data-cash-flow-receivables-export-excel-button]",
  );
  const payablesExportButton = document.querySelector("[data-cash-flow-payables-export-button]");
  const payablesExportExcelButton = document.querySelector(
    "[data-cash-flow-payables-export-excel-button]",
  );
  const summary = document.querySelector("[data-cash-flow-summary]");
  const dashboardSummary = document.querySelector("[data-cash-flow-dashboard-summary]");
  const strategicSummary = document.querySelector("[data-cash-flow-strategic-summary]");
  const chartsMain = document.querySelector("[data-cash-flow-charts-main]");
  const chartsBalance = document.querySelector("[data-cash-flow-charts-balance]");
  const receivablesSummary = document.querySelector("[data-cash-flow-receivables-summary]");
  const payablesSummary = document.querySelector("[data-cash-flow-payables-summary]");
  const receivablesTable = document.querySelector("[data-cash-flow-receivables-table-body]");
  const payablesTable = document.querySelector("[data-cash-flow-payables-table-body]");

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function toggleCustomRange() {
    customRange.hidden = periodSelect.value !== "custom";
  }

  function buildQueryString(filters) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        query.set(key, value);
      }
    });
    return query.toString();
  }

  function renderCards(container, items, negativeKeys = new Set()) {
    container.innerHTML = items
      .map((item) => {
        const className = negativeKeys.has(item.key) && Number(item.numericValue || 0) < 0
          ? "negative-indicator"
          : "";
        return `
          <article class="stat-card compact">
            <span>${item.rotulo}</span>
            <strong class="${className}">${item.valor}</strong>
          </article>
        `;
      })
      .join("");
  }

  function renderSummary(report) {
    renderCards(
      summary,
      [
        {
          key: "saldoAtual",
          rotulo: "Saldo atual",
          valor: formatCurrency(report.fluxoCaixa.saldoAtual),
          numericValue: report.fluxoCaixa.saldoAtual,
        },
        {
          key: "receitasPrevistas",
          rotulo: "Receitas previstas",
          valor: formatCurrency(report.fluxoCaixa.receitasPrevistas),
        },
        {
          key: "receitasRecebidas",
          rotulo: "Receitas recebidas",
          valor: formatCurrency(report.fluxoCaixa.receitasRecebidas),
        },
        {
          key: "despesasPrevistas",
          rotulo: "Despesas previstas",
          valor: formatCurrency(report.fluxoCaixa.despesasPrevistas),
        },
        {
          key: "despesasPagas",
          rotulo: "Despesas pagas",
          valor: formatCurrency(report.fluxoCaixa.despesasPagas),
        },
        {
          key: "saldoProjetado",
          rotulo: "Saldo projetado",
          valor: formatCurrency(report.fluxoCaixa.saldoProjetado),
          numericValue: report.fluxoCaixa.saldoProjetado,
        },
      ],
      new Set(["saldoAtual", "saldoProjetado"]),
    );

    renderCards(
      dashboardSummary,
      [
        {
          key: "faturamentoMes",
          rotulo: "Faturamento do mes",
          valor: formatCurrency(report.dashboardFinanceiro.faturamentoMes),
        },
        {
          key: "despesasMes",
          rotulo: "Despesas do mes",
          valor: formatCurrency(report.dashboardFinanceiro.despesasMes),
        },
        {
          key: "lucroLiquido",
          rotulo: "Lucro liquido",
          valor: formatCurrency(report.dashboardFinanceiro.lucroLiquido),
          numericValue: report.dashboardFinanceiro.lucroLiquido,
        },
        {
          key: "margemOperacional",
          rotulo: "Margem operacional",
          valor: `${report.dashboardFinanceiro.margemOperacional}%`,
          numericValue: report.dashboardFinanceiro.margemOperacional,
        },
        {
          key: "contasVencidas",
          rotulo: "Contas vencidas",
          valor: report.dashboardFinanceiro.contasVencidas,
        },
        {
          key: "fluxoCaixaAcumulado",
          rotulo: "Fluxo acumulado",
          valor: formatCurrency(report.dashboardFinanceiro.fluxoCaixaAcumulado),
          numericValue: report.dashboardFinanceiro.fluxoCaixaAcumulado,
        },
      ],
      new Set(["lucroLiquido", "margemOperacional", "fluxoCaixaAcumulado"]),
    );

    renderCards(strategicSummary, [
      {
        key: "ticketMedioPorCliente",
        rotulo: "Ticket medio por cliente",
        valor: formatCurrency(report.indicadoresEstrategicos.ticketMedioPorCliente),
      },
      {
        key: "receitaPorEntrega",
        rotulo: "Receita por entrega",
        valor: formatCurrency(report.indicadoresEstrategicos.receitaPorEntrega),
      },
      {
        key: "custoPorEntrega",
        rotulo: "Custo por entrega",
        valor: formatCurrency(report.indicadoresEstrategicos.custoPorEntrega),
      },
      {
        key: "lucroPorEntrega",
        rotulo: "Lucro por entrega",
        valor: formatCurrency(report.indicadoresEstrategicos.lucroPorEntrega),
      },
      {
        key: "receitaPorVeiculo",
        rotulo: "Receita por veiculo",
        valor: formatCurrency(report.indicadoresEstrategicos.receitaPorVeiculo),
      },
      {
        key: "lucroPorVeiculo",
        rotulo: "Lucro por veiculo",
        valor: formatCurrency(report.indicadoresEstrategicos.lucroPorVeiculo),
      },
    ]);
  }

  function renderChartCard(title, dataset) {
    if (!Array.isArray(dataset) || dataset.length === 0) {
      return `
        <article class="data-card empty">
          <strong>${title}</strong>
          <p>Sem dados para o periodo selecionado.</p>
        </article>
      `;
    }

    const maxValue = Math.max(...dataset.map((item) => Math.abs(Number(item.valor || 0))), 1);

    return `
      <article class="data-card">
        <h3>${title}</h3>
        <div class="mini-chart">
          ${dataset
            .map(
              (item) => `
                <div class="mini-chart-row">
                  <span>${item.data.slice(5)}</span>
                  <div class="bar-track">
                    <div class="bar-fill" style="width: ${(Math.abs(Number(item.valor || 0)) / maxValue) * 100}%"></div>
                  </div>
                  <strong class="${Number(item.valor || 0) < 0 ? "negative-indicator" : ""}">
                    ${formatCurrency(item.valor)}
                  </strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function renderCharts(report) {
    chartsMain.innerHTML = [
      renderChartCard("Receita por periodo", report.graficos.receitaPorPeriodo),
      renderChartCard("Despesa por periodo", report.graficos.despesaPorPeriodo),
      renderChartCard("Lucro por periodo", report.graficos.lucroPorPeriodo),
    ].join("");

    chartsBalance.innerHTML = renderChartCard("Fluxo acumulado", report.graficos.fluxoAcumulado);
  }

  function renderReceivables(report) {
    renderCards(receivablesSummary, [
      {
        key: "totalReceber",
        rotulo: "Total a receber",
        valor: formatCurrency(report.contasReceber.resumo.totalReceber),
      },
      {
        key: "vencidos",
        rotulo: "Vencidos",
        valor: formatCurrency(report.contasReceber.resumo.vencidos),
      },
      {
        key: "proximosVencimentos",
        rotulo: "Proximos vencimentos",
        valor: formatCurrency(report.contasReceber.resumo.proximosVencimentos),
      },
      {
        key: "recebidos",
        rotulo: "Recebidos",
        valor: formatCurrency(report.contasReceber.resumo.recebidos),
      },
    ]);

    if (report.contasReceber.itens.length === 0) {
      receivablesTable.innerHTML =
        '<tr><td colspan="8">Nenhuma conta a receber encontrada para o periodo selecionado.</td></tr>';
      return;
    }

    receivablesTable.innerHTML = report.contasReceber.itens
      .map(
        (item) => `
          <tr>
            <td>${item.descricao}</td>
            <td>${item.cliente?.nome || "-"}</td>
            <td>${item.entrega?.codigo || "-"}</td>
            <td><span class="status-tag">${createStatusLabel(item.status)}</span></td>
            <td>${item.dataVencimento || item.dataCompetencia || "-"}</td>
            <td>${item.dataPagamento || "-"}</td>
            <td>${formatCurrency(item.valor)}</td>
            <td>
              ${
                item.status !== "pago"
                  ? `<button class="button ghost small" type="button" data-receive-id="${item.id}">Marcar recebido</button>`
                  : '<span class="status-tag status-tag--success">Recebido</span>'
              }
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderPayables(report) {
    renderCards(payablesSummary, [
      {
        key: "totalPagar",
        rotulo: "Total a pagar",
        valor: formatCurrency(report.contasPagar.resumo.totalPagar),
      },
      {
        key: "vencidos",
        rotulo: "Vencidos",
        valor: formatCurrency(report.contasPagar.resumo.vencidos),
      },
      {
        key: "proximosVencimentos",
        rotulo: "Proximos vencimentos",
        valor: formatCurrency(report.contasPagar.resumo.proximosVencimentos),
      },
      {
        key: "pagos",
        rotulo: "Pagos",
        valor: formatCurrency(report.contasPagar.resumo.pagos),
      },
    ]);

    if (report.contasPagar.itens.length === 0) {
      payablesTable.innerHTML =
        '<tr><td colspan="7">Nenhuma conta a pagar encontrada para o periodo selecionado.</td></tr>';
      return;
    }

    payablesTable.innerHTML = report.contasPagar.itens
      .map(
        (item) => `
          <tr>
            <td>${createStatusLabel(item.origem)}</td>
            <td>${item.descricao}</td>
            <td><span class="status-tag">${createStatusLabel(item.status)}</span></td>
            <td>${item.dataVencimento || item.dataCompetencia || "-"}</td>
            <td>${item.dataPagamento || "-"}</td>
            <td>${formatCurrency(item.valor)}</td>
            <td>
              ${
                item.status !== "pago"
                  ? `<button class="button ghost small" type="button" data-pay-origin="${item.origem}" data-pay-id="${item.id}">Marcar pago</button>`
                  : '<span class="status-tag status-tag--success">Pago</span>'
              }
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function refreshData(options = {}) {
    const filters = serializeForm(filterForm);
    const query = buildQueryString(filters);
    const report = await requestJson(`/api/fluxo-caixa${query ? `?${query}` : ""}`);

    renderSummary(report);
    renderCharts(report);
    renderReceivables(report);
    renderPayables(report);

    if (options.successMessage) {
      setMessage(message, "success", options.successMessage);
    }
  }

  function openExport(path) {
    const filters = serializeForm(filterForm);
    const query = buildQueryString(filters);
    window.location.href = `${path}${query ? `?${query}` : ""}`;
  }

  async function handleReceivablesClick(event) {
    const button = event.target.closest("[data-receive-id]");
    if (!button) {
      return;
    }

    const dataPagamento = window.prompt("Informe a data de recebimento (YYYY-MM-DD):");
    if (!dataPagamento) {
      return;
    }

    try {
      const response = await requestJson(`/api/fluxo-caixa/receber/${button.dataset.receiveId}`, {
        method: "PATCH",
        body: JSON.stringify({ dataPagamento }),
      });
      await refreshData({ successMessage: response.mensagem });
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handlePayablesClick(event) {
    const button = event.target.closest("[data-pay-id]");
    if (!button) {
      return;
    }

    const dataPagamento = window.prompt("Informe a data de pagamento (YYYY-MM-DD):");
    if (!dataPagamento) {
      return;
    }

    const path =
      button.dataset.payOrigin === "frota"
        ? `/api/fluxo-caixa/pagar/frota/${button.dataset.payId}`
        : `/api/fluxo-caixa/pagar/financeiro/${button.dataset.payId}`;

    try {
      const response = await requestJson(path, {
        method: "PATCH",
        body: JSON.stringify({ dataPagamento }),
      });
      await refreshData({ successMessage: response.mensagem });
    } catch (error) {
      handlePageError(error);
    }
  }

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    refreshData().catch(handlePageError);
  });
  periodSelect.addEventListener("change", toggleCustomRange);
  refreshButton.addEventListener("click", () => refreshData().catch(handlePageError));
  exportButton.addEventListener("click", () => openExport("/api/fluxo-caixa/export.csv"));
  exportExcelButton.addEventListener("click", () => openExport("/api/fluxo-caixa/export.xlsx"));
  receivablesExportButton.addEventListener("click", () =>
    openExport("/api/fluxo-caixa/receber/export.csv"),
  );
  receivablesExportExcelButton.addEventListener("click", () =>
    openExport("/api/fluxo-caixa/receber/export.xlsx"),
  );
  payablesExportButton.addEventListener("click", () =>
    openExport("/api/fluxo-caixa/pagar/export.csv"),
  );
  payablesExportExcelButton.addEventListener("click", () =>
    openExport("/api/fluxo-caixa/pagar/export.xlsx"),
  );
  receivablesTable.addEventListener("click", (event) => {
    handleReceivablesClick(event).catch(handlePageError);
  });
  payablesTable.addEventListener("click", (event) => {
    handlePayablesClick(event).catch(handlePageError);
  });

  toggleCustomRange();
  refreshData().catch(handlePageError);
}

document.addEventListener("DOMContentLoaded", createCashFlowApp);
