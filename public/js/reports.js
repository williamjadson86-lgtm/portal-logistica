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
  const tableBody = document.querySelector("[data-reports-table-body]");
  const detailSummary = document.querySelector("[data-reports-detail-summary]");
  const detailBlocks = document.querySelector("[data-reports-detail-blocks]");
  const rankingMain = document.querySelector("[data-reports-ranking-main]");
  const rankingAlerts = document.querySelector("[data-reports-ranking-alerts]");
  const refreshButton = document.querySelector("[data-reports-refresh-button]");
  const clearFiltersButton = document.querySelector("[data-reports-clear-filters-button]");
  const exportButton = document.querySelector("[data-reports-export-button]");
  const exportExcelButton = document.querySelector("[data-reports-export-excel-button]");
  const clientSelect = document.querySelector("[data-reports-filter-form] [name='clienteId']");

  let rows = [];
  let availableClients = [];
  let selectedClientId = null;

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

  function renderClientOptions() {
    const options = availableClients
      .map((client) => `<option value="${client.id}">${client.nome}</option>`)
      .join("");

    clientSelect.innerHTML = `<option value="">Todos os clientes</option>${options}`;
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Clientes no relatorio", valor: data.totalClientes },
      { rotulo: "Total de entregas", valor: data.totalEntregas },
      { rotulo: "Comprovantes", valor: data.totalComprovantes },
      { rotulo: "Receita total", valor: formatCurrency(data.receitaTotal) },
      { rotulo: "Valor pendente", valor: formatCurrency(data.valorPendente) },
      { rotulo: "Valor pago", valor: formatCurrency(data.valorPago) },
      { rotulo: "Lancamentos vencidos", valor: data.lancamentosVencidos },
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

  function renderTable() {
    if (rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="9">Nenhum cliente encontrado para os filtros selecionados.</td></tr>';
      return;
    }

    tableBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${row.nome}</td>
            <td>${row.totalEntregas}</td>
            <td>${row.totalRotasVinculadas}</td>
            <td>${row.totalComprovantes}</td>
            <td>${formatCurrency(row.receitaTotal)}</td>
            <td>${formatCurrency(row.valorPendente)}</td>
            <td>${formatCurrency(row.valorPago)}</td>
            <td>${formatCurrency(row.ticketMedioPorEntrega)}</td>
            <td>
              <button class="button ghost small" type="button" data-action="view" data-id="${row.clienteId}">
                Visualizar detalhe
              </button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderRankingList(title, items, formatter) {
    if (!Array.isArray(items) || items.length === 0) {
      return `
        <article class="data-card empty">
          <strong>${title}</strong>
          <p>Nenhum cliente encontrado para este ranking.</p>
        </article>
      `;
    }

    return `
      <article class="data-card">
        <h3>${title}</h3>
        ${items
          .map(
            (item, index) => `
              <p>${index + 1}. ${item.nome} | ${formatter(item)}</p>
            `,
          )
          .join("")}
      </article>
    `;
  }

  function renderRankings(ranking) {
    if (!ranking) {
      rankingMain.innerHTML = `
        <article class="data-card empty">
          <strong>Ranking indisponivel</strong>
          <p>Carregue os relatorios para visualizar os destaques comerciais.</p>
        </article>
      `;
      rankingAlerts.innerHTML = `
        <article class="data-card empty">
          <strong>Nenhum alerta carregado</strong>
          <p>Os clientes com maior pendencia e vencimento aparecerao aqui.</p>
        </article>
      `;
      return;
    }

    rankingMain.innerHTML = [
      renderRankingList("Top 5 por receita", ranking.topReceita, (item) =>
        formatCurrency(item.receitaTotal),
      ),
      renderRankingList("Top 5 por volume de entregas", ranking.topVolumeEntregas, (item) =>
        `${item.totalEntregas} entregas`,
      ),
    ].join("");

    rankingAlerts.innerHTML = [
      renderRankingList("Top 5 por valor pendente", ranking.topValorPendente, (item) =>
        formatCurrency(item.valorPendente),
      ),
      renderRankingList(
        "Clientes com lancamentos vencidos",
        ranking.clientesComLancamentosVencidos,
        (item) => `${item.lancamentosVencidos} vencido(s)`,
      ),
    ].join("");
  }

  function renderDetail(detail) {
    if (!detail) {
      detailSummary.className = "delivery-details empty";
      detailSummary.textContent =
        "Selecione um cliente no relatorio para visualizar o detalhe operacional e financeiro.";
      detailBlocks.innerHTML = `
        <article class="data-card empty">
          <strong>Nenhum cliente selecionado</strong>
          <p>Use a tabela para visualizar entregas, financeiro e comprovantes vinculados.</p>
        </article>
      `;
      return;
    }

    detailSummary.className = "delivery-details";
    detailSummary.innerHTML = `
      <div class="detail-grid">
        <div><span>Cliente</span><strong>${detail.cliente.nome}</strong></div>
        <div><span>Status</span><strong>${createStatusLabel(detail.cliente.status)}</strong></div>
        <div><span>Documento</span><strong>${detail.cliente.documento}</strong></div>
        <div><span>Cidade / UF</span><strong>${detail.cliente.cidade} / ${detail.cliente.estado}</strong></div>
        <div><span>Total de entregas</span><strong>${detail.resumoOperacional.totalEntregas}</strong></div>
        <div><span>Receita total</span><strong>${formatCurrency(detail.resumoFinanceiro.receitaTotal)}</strong></div>
      </div>
    `;

    const entregaItems =
      detail.entregasRecentes.length > 0
        ? detail.entregasRecentes
            .map(
              (item) => `
                <article class="data-card">
                  <div class="data-card-top">
                    <div>
                      <h3>${item.codigo}</h3>
                      <p>${item.origem} -> ${item.destino}</p>
                    </div>
                    <span class="status-tag">${createStatusLabel(item.status)}</span>
                  </div>
                  <strong>${item.dataPrevista || "Sem data prevista"}</strong>
                  <p>${item.rotaAtual ? `Rota ${item.rotaAtual.codigo}` : "Sem rota ativa"}</p>
                </article>
              `,
            )
            .join("")
        : '<article class="data-card empty"><strong>Nenhuma entrega recente</strong><p>Este cliente ainda nao possui entregas vinculadas.</p></article>';

    const financialItems =
      detail.lancamentosRecentes.length > 0
        ? detail.lancamentosRecentes
            .map(
              (item) => `
                <article class="data-card">
                  <div class="data-card-top">
                    <div>
                      <h3>${item.descricao}</h3>
                      <p>${item.entrega?.codigo || "Sem entrega vinculada"}</p>
                    </div>
                    <span class="status-tag">${createStatusLabel(item.status)}</span>
                  </div>
                  <strong>${formatCurrency(item.valor)}</strong>
                  <p>${item.dataCompetencia || "Sem competencia"} | ${createStatusLabel(item.tipo)}</p>
                </article>
              `,
            )
            .join("")
        : '<article class="data-card empty"><strong>Nenhum lancamento recente</strong><p>Este cliente ainda nao possui historico financeiro vinculado.</p></article>';

    const proofItems =
      detail.comprovantes.length > 0
        ? detail.comprovantes
            .map(
              (item) => `
                <article class="data-card">
                  <div class="data-card-top">
                    <div>
                      <h3>${item.arquivoNome || item.tipo}</h3>
                      <p>${item.codigoEntrega}</p>
                    </div>
                    <span class="status-tag">${item.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                  <strong>${item.tipo}</strong>
                  <p>${item.observacao || "Sem observacao"}</p>
                </article>
              `,
            )
            .join("")
        : '<article class="data-card empty"><strong>Nenhum comprovante vinculado</strong><p>As entregas deste cliente ainda nao possuem comprovantes registrados.</p></article>';

    detailBlocks.innerHTML = `
      <section class="dashboard-two-columns">
        <article class="module-panel">
          <div class="section-heading">
            <div>
              <span class="status-pill subtle">Resumo operacional</span>
              <h2>Operacao</h2>
            </div>
          </div>
          <div class="module-list">
            <article class="data-card">
              <strong>Pendentes: ${detail.resumoOperacional.entregasPendentes}</strong>
              <p>Em rota: ${detail.resumoOperacional.entregasEmRota} | Entregues: ${detail.resumoOperacional.entregasEntregues} | Canceladas: ${detail.resumoOperacional.entregasCanceladas}</p>
            </article>
            <article class="data-card">
              <strong>Rotas vinculadas: ${detail.resumoOperacional.totalRotasVinculadas}</strong>
              <p>Comprovantes ativos: ${detail.resumoOperacional.totalComprovantes}</p>
            </article>
          </div>
        </article>

        <article class="module-panel">
          <div class="section-heading">
            <div>
              <span class="status-pill subtle">Resumo financeiro</span>
              <h2>Financeiro</h2>
            </div>
          </div>
          <div class="module-list">
            <article class="data-card">
              <strong>Receita: ${formatCurrency(detail.resumoFinanceiro.receitaTotal)}</strong>
              <p>Pendente: ${formatCurrency(detail.resumoFinanceiro.valorPendente)} | Pago: ${formatCurrency(detail.resumoFinanceiro.valorPago)}</p>
            </article>
            <article class="data-card">
              <strong>Lancamentos vencidos: ${detail.resumoFinanceiro.lancamentosVencidos}</strong>
              <p>Acompanhamento gerencial do cliente.</p>
            </article>
          </div>
        </article>
      </section>

      <section class="dashboard-two-columns">
        <article class="module-panel">
          <div class="section-heading">
            <div>
              <span class="status-pill subtle">Entregas recentes</span>
              <h2>Ultimas entregas</h2>
            </div>
          </div>
          <div class="module-list">${entregaItems}</div>
        </article>

        <article class="module-panel">
          <div class="section-heading">
            <div>
              <span class="status-pill subtle">Financeiro recente</span>
              <h2>Ultimos lancamentos</h2>
            </div>
          </div>
          <div class="module-list">${financialItems}</div>
        </article>
      </section>

      <article class="module-panel">
        <div class="section-heading">
          <div>
            <span class="status-pill subtle">Comprovantes</span>
            <h2>Historico vinculado</h2>
          </div>
        </div>
        <div class="module-list">${proofItems}</div>
      </article>
    `;
  }

  async function loadDetail(clientId) {
    const detail = await requestJson(`/api/relatorios/clientes/${clientId}`);
    selectedClientId = clientId;
    renderDetail(detail);
  }

  async function refreshList(options = {}) {
    const filters = serializeForm(filterForm);
    const query = buildQueryString(filters);

    loading.hidden = false;
    setMessage(message, "", "");

    try {
      const response = await requestJson(`/api/relatorios/clientes${query ? `?${query}` : ""}`);
      rows = response.clientes;
      availableClients = response.apoio.clientes || [];
      renderClientOptions();
      clientSelect.value = filters.clienteId || "";
      renderSummaryCards(response.resumo);
      renderRankings(response.ranking);
      renderTable();

      if (selectedClientId) {
        const selectedExists = rows.some((row) => row.clienteId === selectedClientId);
        if (selectedExists) {
          await loadDetail(selectedClientId);
        } else {
          selectedClientId = null;
          renderDetail(null);
        }
      } else {
        renderDetail(null);
      }

      if (options.successMessage) {
        setMessage(message, "success", options.successMessage);
      }
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

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='view']");
    if (!button) {
      return;
    }

    loadDetail(button.dataset.id).catch(handlePageError);
  });

  refreshButton.addEventListener("click", () => refreshList().catch(handlePageError));
  clearFiltersButton.addEventListener("click", () => {
    filterForm.reset();
    setDefaultRange();
    selectedClientId = null;
    refreshList().catch(handlePageError);
  });
  exportButton.addEventListener("click", () => {
    const filters = serializeForm(filterForm);
    const query = buildQueryString(filters);
    window.location.href = `/api/relatorios/clientes/export.csv${query ? `?${query}` : ""}`;
  });
  exportExcelButton.addEventListener("click", () => {
    const filters = serializeForm(filterForm);
    const query = buildQueryString(filters);
    window.location.href = `/api/relatorios/clientes/export.xlsx${query ? `?${query}` : ""}`;
  });

  setDefaultRange();
  renderDetail(null);
  renderRankings(null);
  refreshList().catch(handlePageError);
}

document.addEventListener("DOMContentLoaded", createReportsApp);
