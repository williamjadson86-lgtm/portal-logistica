function createReportsApp() {
  const root = document.querySelector("[data-reports-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel, formatCurrency } =
    window.portalUtils;
  const message = document.querySelector("[data-reports-message]");
  const loading = document.querySelector("[data-reports-loading]");
  const filterForm = document.querySelector("[data-reports-filter-form]");
  const summary = document.querySelector("[data-reports-summary]");
  const deliveriesSummary = document.querySelector("[data-reports-deliveries-summary]");
  const financialSummary = document.querySelector("[data-reports-financial-summary]");
  const fleetSummary = document.querySelector("[data-reports-fleet-summary]");
  const fleetVehicles = document.querySelector("[data-reports-fleet-vehicles]");
  const fleetMaintenances = document.querySelector("[data-reports-fleet-maintenances]");
  const deliveriesTableBody = document.querySelector("[data-reports-deliveries-table-body]");
  const financialTableBody = document.querySelector("[data-reports-financial-table-body]");
  const refreshButton = document.querySelector("[data-reports-refresh-button]");
  const clearFiltersButton = document.querySelector("[data-reports-clear-filters-button]");
  const clientSelect = filterForm.querySelector("[name='clienteId']");
  const vehicleSelect = filterForm.querySelector("[name='veiculoId']");
  const driverSelect = filterForm.querySelector("[name='motoristaId']");

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
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

  function renderSelectOptions(select, items, formatter, emptyLabel) {
    select.innerHTML =
      `<option value="">${emptyLabel}</option>` +
      items.map((item) => `<option value="${item.id}">${formatter(item)}</option>`).join("");
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total de entregas", valor: data.totalEntregas },
      { rotulo: "Receita total", valor: formatCurrency(data.receitaTotal) },
      { rotulo: "Despesa total", valor: formatCurrency(data.despesaTotal) },
      { rotulo: "Resultado financeiro", valor: formatCurrency(data.resultadoFinanceiro) },
    ];

    summary.innerHTML = cards
      .map(
        (item) => `
          <article class="stat-card compact">
            <span>${item.rotulo}</span>
            <strong>${item.valor}</strong>
          </article>
        `,
      )
      .join("");
  }

  function renderMetricList(container, items, emptyText) {
    if (!items || items.length === 0) {
      container.innerHTML = `
        <article class="data-card empty">
          <strong>Sem dados</strong>
          <p>${emptyText}</p>
        </article>
      `;
      return;
    }

    container.innerHTML = items
      .map(
        (item) => `
          <article class="data-card">
            <h3>${item.titulo}</h3>
            <strong>${item.valor}</strong>
            <p>${item.descricao}</p>
          </article>
        `,
      )
      .join("");
  }

  function renderDeliveriesReport(report) {
    const statusItems = Object.entries(report.resumo.porStatus || {}).map(([status, total]) => ({
      titulo: createStatusLabel(status),
      valor: total,
      descricao: "Entregas neste status com os filtros atuais.",
    }));
    const regionItems = (report.resumo.porCidadeEstado || []).slice(0, 5).map((item) => ({
      titulo: `${item.cidade} / ${item.estado}`,
      valor: `${item.total} entrega(s)`,
      descricao: `Pendentes: ${item.pendentes} | Entregues: ${item.entregues}`,
    }));

    renderMetricList(
      deliveriesSummary,
      [...statusItems, ...regionItems],
      "Nenhuma entrega encontrada para os filtros aplicados.",
    );

    if (!Array.isArray(report.entregas) || report.entregas.length === 0) {
      deliveriesTableBody.innerHTML = '<tr><td colspan="6">Nenhuma entrega encontrada.</td></tr>';
      return;
    }

    deliveriesTableBody.innerHTML = report.entregas
      .map(
        (item) => `
          <tr>
            <td>${item.codigo}</td>
            <td>${item.cliente}</td>
            <td>${item.cidade || "-"} / ${item.estado || "-"}</td>
            <td><span class="status-tag">${createStatusLabel(item.status)}</span></td>
            <td>${item.dataPrevista || "-"}</td>
            <td>${item.valorFrete != null ? formatCurrency(item.valorFrete) : "-"}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderFinancialReport(report) {
    const statusItems = Object.entries(report.resumo.porStatus || {}).map(([status, total]) => ({
      titulo: `Status ${createStatusLabel(status)}`,
      valor: formatCurrency(total),
      descricao: "Volume consolidado por status.",
    }));
    const typeItems = Object.entries(report.resumo.porTipo || {}).map(([tipo, total]) => ({
      titulo: `Tipo ${createStatusLabel(tipo)}`,
      valor: formatCurrency(total),
      descricao: "Volume consolidado por tipo de lancamento.",
    }));

    renderMetricList(
      financialSummary,
      [
        { titulo: "Receita", valor: formatCurrency(report.resumo.receitaTotal), descricao: "Receita operacional no periodo." },
        { titulo: "Despesas", valor: formatCurrency(report.resumo.despesaTotal), descricao: "Despesas e repasses filtrados." },
        { titulo: "Resultado", valor: formatCurrency(report.resumo.resultadoFinanceiro), descricao: "Receita menos despesas." },
        ...statusItems,
        ...typeItems,
      ],
      "Nenhum lancamento encontrado para os filtros aplicados.",
    );

    if (!Array.isArray(report.lancamentos) || report.lancamentos.length === 0) {
      financialTableBody.innerHTML = '<tr><td colspan="6">Nenhum lancamento encontrado.</td></tr>';
      return;
    }

    financialTableBody.innerHTML = report.lancamentos
      .map(
        (item) => `
          <tr>
            <td>${item.descricao}</td>
            <td>${createStatusLabel(item.tipo)}</td>
            <td><span class="status-tag">${createStatusLabel(item.status)}</span></td>
            <td>${item.cliente?.nome || "-"}</td>
            <td>${item.dataCompetencia || "-"}</td>
            <td>${formatCurrency(item.valor)}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderFleetReport(report) {
    const cards = [
      { rotulo: "Receita operacional", valor: formatCurrency(report.resumo.receitaTotal) },
      { rotulo: "Despesa da frota", valor: formatCurrency(report.resumo.despesaTotal) },
      { rotulo: "Resultado liquido", valor: formatCurrency(report.resumo.resultadoLiquido) },
      { rotulo: "Margem operacional", valor: `${report.resumo.margemOperacional}%` },
      { rotulo: "Veiculos com movimento", valor: report.resumo.totalVeiculosComMovimento },
      { rotulo: "Motoristas com movimento", valor: report.resumo.totalMotoristasComMovimento },
    ];

    fleetSummary.innerHTML = cards
      .map(
        (item) => `
          <article class="stat-card compact">
            <span>${item.rotulo}</span>
            <strong>${item.valor}</strong>
          </article>
        `,
      )
      .join("");

    renderMetricList(
      fleetVehicles,
      (report.ranking.custosPorVeiculo || []).map((item) => ({
        titulo: `${item.placa} - ${item.modelo}`,
        valor: formatCurrency(item.despesaTotal),
        descricao: `Entregas: ${item.totalEntregas} | Receita: ${formatCurrency(item.receitaTotal)} | Margem: ${item.margem}%`,
      })),
      "Nenhum custo de frota encontrado para os filtros aplicados.",
    );

    renderMetricList(
      fleetMaintenances,
      (report.manutencoesPorVeiculo || []).map((item) => ({
        titulo: `${item.placa} - ${item.modelo}`,
        valor: formatCurrency(item.custoTotal),
        descricao: `${item.totalManutencoes} manutencao(oes) vinculada(s).`,
      })),
      "Nenhuma manutencao encontrada para os filtros aplicados.",
    );
  }

  async function refreshList() {
    const filters = serializeForm(filterForm);
    const query = buildQueryString(filters);

    loading.hidden = false;
    setMessage(message, "", "");

    try {
      const [summaryReport, deliveriesReport, financialReport, fleetReport] = await Promise.all([
        requestJson(`/api/relatorios/resumo${query ? `?${query}` : ""}`),
        requestJson(`/api/relatorios/entregas${query ? `?${query}` : ""}`),
        requestJson(`/api/relatorios/financeiro${query ? `?${query}` : ""}`),
        requestJson(`/api/relatorios/frota${query ? `?${query}` : ""}`),
      ]);

      renderSummaryCards(summaryReport.resumo);
      renderDeliveriesReport(deliveriesReport);
      renderFinancialReport(financialReport);
      renderFleetReport(fleetReport);

      const support = summaryReport.apoio || { clientes: [], veiculos: [], motoristas: [] };
      renderSelectOptions(clientSelect, support.clientes || [], (item) => item.nome, "Todos os clientes");
      renderSelectOptions(vehicleSelect, support.veiculos || [], (item) => `${item.placa} - ${item.modelo}`, "Todos os veiculos");
      renderSelectOptions(driverSelect, support.motoristas || [], (item) => item.nome, "Todos os motoristas");

      clientSelect.value = filters.clienteId || "";
      vehicleSelect.value = filters.veiculoId || "";
      driverSelect.value = filters.motoristaId || "";
    } catch (error) {
      handlePageError(error);
    } finally {
      loading.hidden = true;
    }
  }

  function setDefaultRange() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    filterForm.elements.dataInicio.value = start.toISOString().slice(0, 10);
    filterForm.elements.dataFim.value = end.toISOString().slice(0, 10);
  }

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    refreshList().catch(handlePageError);
  });

  refreshButton.addEventListener("click", () => refreshList().catch(handlePageError));
  clearFiltersButton.addEventListener("click", () => {
    filterForm.reset();
    setDefaultRange();
    refreshList().catch(handlePageError);
  });

  document.querySelectorAll("[data-export-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const filters = serializeForm(filterForm);
      const query = buildQueryString({
        ...filters,
        tipo: button.dataset.exportType,
        formato: button.dataset.exportFormat,
      });
      window.location.href = `/api/relatorios/export?${query}`;
    });
  });

  setDefaultRange();
  refreshList().catch(handlePageError);
}

document.addEventListener("DOMContentLoaded", createReportsApp);
