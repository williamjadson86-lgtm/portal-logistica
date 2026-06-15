function createFinancialApp() {
  const root = document.querySelector("[data-financial-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel, formatCurrency } =
    window.portalUtils;
  const message = document.querySelector("[data-financial-message]");
  const summary = document.querySelector("[data-financial-summary]");
  const filterForm = document.querySelector("[data-financial-filter-form]");
  const form = document.querySelector("[data-financial-form]");
  const formTitle = document.querySelector("[data-financial-form-title]");
  const submitButton = document.querySelector("[data-financial-submit-button]");
  const cancelEditButton = document.querySelector("[data-financial-cancel-edit-button]");
  const tableBody = document.querySelector("[data-financial-table-body]");
  const details = document.querySelector("[data-financial-details]");
  const statusForm = document.querySelector("[data-financial-status-form]");
  const quickStatus = document.querySelector("[data-financial-status-form] [name='status']");
  const quickPayment = document.querySelector("[data-financial-status-form] [name='dataPagamento']");
  const refreshButton = document.querySelector("[data-financial-refresh-button]");
  const clearFiltersButton = document.querySelector("[data-financial-clear-filters-button]");
  const newButton = document.querySelector("[data-financial-new-button]");
  const clientFilterSelect = document.querySelector("[data-financial-filter-form] [name='clienteId']");
  const clientSelect = document.querySelector("[data-financial-form] [name='clienteId']");
  const deliverySelect = document.querySelector("[data-financial-form] [name='entregaId']");

  let entries = [];
  let supportData = { clientes: [], entregas: [] };
  let selectedId = null;

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function findEntry(id) {
    return entries.find((entry) => entry.id === id) || null;
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

  function createFinanceBadge(expense) {
    if (expense.status === "cancelado") {
      return '<span class="status-tag status-tag--danger">Cancelada</span>';
    }

    if (expense.integrarFinanceiro) {
      return '<span class="status-tag status-tag--success">Integrada</span>';
    }

    return '<span class="status-tag status-tag--neutral">Nao integrada</span>';
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total pendente", valor: formatCurrency(data.totalPendente) },
      { rotulo: "Total faturado", valor: formatCurrency(data.totalFaturado) },
      { rotulo: "Total pago", valor: formatCurrency(data.totalPago) },
      { rotulo: "Total cancelado", valor: formatCurrency(data.totalCancelado) },
      { rotulo: "Receita total do periodo", valor: formatCurrency(data.receitaTotalPeriodo) },
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

  function renderClientOptions() {
    const options = supportData.clientes
      .map(
        (client) =>
          `<option value="${client.id}">${client.nome} (${createStatusLabel(client.status)})</option>`,
      )
      .join("");

    clientFilterSelect.innerHTML = `<option value="">Todos os clientes</option>${options}`;
    clientSelect.innerHTML = `<option value="">Sem cliente vinculado</option>${options}`;
  }

  function renderDeliveryOptions() {
    const options = supportData.entregas
      .map((delivery) => {
        const blocked = delivery.temLancamentoAtivo ? " [ja vinculada]" : "";
        const freight =
          delivery.valorFrete != null ? ` | ${formatCurrency(delivery.valorFrete)}` : "";

        return `<option value="${delivery.id}">
          ${delivery.codigo} - ${delivery.cliente} (${createStatusLabel(delivery.status)})${freight}${blocked}
        </option>`;
      })
      .join("");

    deliverySelect.innerHTML = `<option value="">Sem entrega vinculada</option>${options}`;
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.tipo.value = "receita";
    form.elements.status.value = "pendente";
    form.elements.dataCompetencia.value = new Date().toISOString().slice(0, 10);
    formTitle.textContent = "Novo lancamento";
    submitButton.textContent = "Salvar lancamento";
    cancelEditButton.hidden = true;
  }

  function fillForm(entry) {
    form.elements.id.value = entry.id;
    form.elements.tipo.value = entry.tipo;
    form.elements.status.value = entry.status;
    form.elements.descricao.value = entry.descricao;
    form.elements.clienteId.value = entry.clienteId || "";
    form.elements.entregaId.value = entry.entregaId || "";
    form.elements.valor.value = entry.valor;
    form.elements.dataCompetencia.value = entry.dataCompetencia || "";
    form.elements.dataVencimento.value = entry.dataVencimento || "";
    form.elements.dataPagamento.value = entry.dataPagamento || "";
    form.elements.observacoes.value = entry.observacoes || "";
    formTitle.textContent = `Editar ${entry.descricao}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderDetails(entry) {
    if (!entry) {
      details.className = "delivery-details empty";
      details.textContent = "Selecione um lancamento para visualizar os detalhes financeiros.";
      quickStatus.value = "pendente";
      quickPayment.value = "";
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>Descricao</span><strong>${entry.descricao}</strong></div>
        <div><span>Status</span><strong>${createStatusLabel(entry.status)}</strong></div>
        <div><span>Tipo</span><strong>${createStatusLabel(entry.tipo)}</strong></div>
        <div><span>Valor</span><strong>${formatCurrency(entry.valor)}</strong></div>
        <div><span>Cliente</span><strong>${entry.cliente?.nome || "Nao vinculado"}</strong></div>
        <div><span>Entrega</span><strong>${entry.entrega?.codigo || "Nao vinculada"}</strong></div>
        <div><span>Competencia</span><strong>${entry.dataCompetencia || "-"}</strong></div>
        <div><span>Vencimento</span><strong>${entry.dataVencimento || "-"}</strong></div>
        <div><span>Pagamento</span><strong>${entry.dataPagamento || "-"}</strong></div>
        <div><span>Observacoes</span><strong>${entry.observacoes || "Sem observacoes"}</strong></div>
      </div>
    `;
    quickStatus.value = entry.status;
    quickPayment.value = entry.dataPagamento || "";
  }

  function renderTable() {
    if (entries.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8">Nenhum lancamento encontrado para os filtros selecionados.</td></tr>';
      return;
    }

    tableBody.innerHTML = entries
      .map(
        (entry) => `
          <tr>
            <td>${entry.descricao}</td>
            <td>${entry.cliente?.nome || "Avulso"}</td>
            <td>${entry.entrega?.codigo || "-"}</td>
            <td>${createStatusLabel(entry.tipo)}</td>
            <td><span class="status-tag">${createStatusLabel(entry.status)}</span></td>
            <td>${entry.dataCompetencia || "-"}</td>
            <td>${formatCurrency(entry.valor)}</td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="view" data-id="${entry.id}">Visualizar</button>
                <button class="button ghost small" type="button" data-action="edit" data-id="${entry.id}">Editar</button>
                <button class="button ghost small" type="button" data-action="status" data-id="${entry.id}">Atualizar status</button>
                <button class="button ghost small danger" type="button" data-action="delete" data-id="${entry.id}">Cancelar</button>
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function loadDetails(id) {
    const response = await requestJson(`/api/financeiro/${id}`);
    selectedId = response.lancamento.id;
    renderDetails(response.lancamento);
    return response.lancamento;
  }

  async function refreshList(options = {}) {
    const filters = serializeForm(filterForm);
    const currentFormClientId = form.elements.clienteId.value;
    const currentFormEntregaId = form.elements.entregaId.value;
    const query = buildQueryString(filters);
    const response = await requestJson(`/api/financeiro${query ? `?${query}` : ""}`);

    entries = response.lancamentos;
    supportData = response.apoio;
    renderSummaryCards(response.resumo);
    renderClientOptions();
    renderDeliveryOptions();
    clientFilterSelect.value = filters.clienteId || "";
    form.elements.clienteId.value = currentFormClientId || "";
    form.elements.entregaId.value = currentFormEntregaId || "";
    renderTable();

    if (selectedId) {
      const selected = findEntry(selectedId);
      if (selected) {
        renderDetails(selected);
      } else {
        selectedId = null;
        renderDetails(null);
      }
    } else {
      renderDetails(null);
    }

    if (options.successMessage) {
      setMessage(message, "success", options.successMessage);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = serializeForm(form);
    const financialId = payload.id;
    delete payload.id;

    if (!payload.clienteId) {
      delete payload.clienteId;
    }

    if (!payload.entregaId) {
      delete payload.entregaId;
    }

    if (!payload.dataVencimento) {
      delete payload.dataVencimento;
    }

    if (!payload.dataPagamento) {
      delete payload.dataPagamento;
    }

    if (!payload.observacoes) {
      delete payload.observacoes;
    }

    try {
      const response = financialId
        ? await requestJson(`/api/financeiro/${financialId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/financeiro", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      selectedId = response.lancamento.id;
      resetForm();
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedId);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (!selectedId) {
      setMessage(message, "error", "Selecione um lancamento antes de atualizar o status.");
      return;
    }

    try {
      const payload = { status: quickStatus.value };
      if (quickPayment.value) {
        payload.dataPagamento = quickPayment.value;
      }

      const response = await requestJson(`/api/financeiro/${selectedId}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedId);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleTableAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;

    try {
      if (action === "view") {
        await loadDetails(id);
        return;
      }

      if (action === "edit") {
        fillForm(await loadDetails(id));
        return;
      }

      if (action === "status") {
        await loadDetails(id);
        statusForm.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (action === "delete") {
        const entry = findEntry(id) || (await loadDetails(id));
        if (!window.confirm(`Deseja cancelar o lancamento ${entry.descricao}?`)) {
          return;
        }

        const response = await requestJson(`/api/financeiro/${id}`, { method: "DELETE" });
        if (selectedId === id) {
          selectedId = null;
        }
        resetForm();
        await refreshList({ successMessage: response.mensagem });
      }
    } catch (error) {
      handlePageError(error);
    }
  }

  form.addEventListener("submit", handleSubmit);
  statusForm.addEventListener("submit", handleStatusSubmit);
  tableBody.addEventListener("click", handleTableAction);
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    refreshList().catch(handlePageError);
  });
  refreshButton.addEventListener("click", () => refreshList().catch(handlePageError));
  clearFiltersButton.addEventListener("click", () => {
    filterForm.reset();
    refreshList().catch(handlePageError);
  });
  newButton.addEventListener("click", () => {
    resetForm();
    setMessage(message, "", "");
  });
  cancelEditButton.addEventListener("click", () => {
    resetForm();
    setMessage(message, "", "");
  });

  resetForm();
  renderDetails(null);
  refreshList().catch(handlePageError);
}

document.addEventListener("DOMContentLoaded", createFinancialApp);

function createFleetCostApp() {
  const root = document.querySelector("[data-fleet-cost-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel, formatCurrency } =
    window.portalUtils;
  const message = document.querySelector("[data-fleet-cost-message]");
  const summary = document.querySelector("[data-fleet-cost-summary]");
  const filterForm = document.querySelector("[data-fleet-cost-filter-form]");
  const form = document.querySelector("[data-fleet-cost-form]");
  const formTitle = document.querySelector("[data-fleet-cost-form-title]");
  const submitButton = document.querySelector("[data-fleet-cost-submit-button]");
  const cancelEditButton = document.querySelector("[data-fleet-cost-cancel-edit-button]");
  const refreshButton = document.querySelector("[data-fleet-cost-refresh-button]");
  const clearFiltersButton = document.querySelector("[data-fleet-cost-clear-filters-button]");
  const newButton = document.querySelector("[data-fleet-cost-new-button]");
  const tableBody = document.querySelector("[data-fleet-cost-table-body]");
  const vehicleFilterSelect = document.querySelector("[data-fleet-cost-filter-form] [name='veiculoId']");
  const driverFilterSelect = document.querySelector("[data-fleet-cost-filter-form] [name='motoristaId']");
  const vehicleSelect = document.querySelector("[data-fleet-cost-form] [name='veiculoId']");
  const driverSelect = document.querySelector("[data-fleet-cost-form] [name='motoristaId']");

  let expenses = [];
  let supportData = { veiculos: [], motoristas: [] };

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

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Despesa total", valor: formatCurrency(data.totalDespesas) },
      { rotulo: "Pago", valor: formatCurrency(data.totalPago) },
      { rotulo: "Pendente", valor: formatCurrency(data.totalPendente) },
      { rotulo: "Vencidas", valor: data.totalVencidas },
      { rotulo: "Integradas ao financeiro", valor: data.totalIntegradasFinanceiro },
      { rotulo: "Controle interno", valor: data.totalControleInterno },
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

  function renderSupportOptions() {
    const vehicleOptions = supportData.veiculos
      .map(
        (vehicle) =>
          `<option value="${vehicle.id}">${vehicle.placa} - ${vehicle.modelo} (${createStatusLabel(vehicle.status)})</option>`,
      )
      .join("");
    const driverOptions = supportData.motoristas
      .map(
        (driver) =>
          `<option value="${driver.id}">${driver.nome} (${createStatusLabel(driver.status)})</option>`,
      )
      .join("");

    vehicleFilterSelect.innerHTML = `<option value="">Todos os veiculos</option>${vehicleOptions}`;
    driverFilterSelect.innerHTML = `<option value="">Todos os motoristas</option>${driverOptions}`;
    vehicleSelect.innerHTML = `<option value="">Selecione um veiculo</option>${vehicleOptions}`;
    driverSelect.innerHTML = `<option value="">Sem motorista vinculado</option>${driverOptions}`;
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.tipo.value = "abastecimento";
    form.elements.status.value = "pendente";
    form.elements.integrarFinanceiro.checked = true;
    form.elements.dataDespesa.value = new Date().toISOString().slice(0, 10);
    formTitle.textContent = "Nova despesa";
    submitButton.textContent = "Salvar despesa";
    cancelEditButton.hidden = true;
  }

  function fillForm(expense) {
    form.elements.id.value = expense.id;
    form.elements.tipo.value = expense.tipo;
    form.elements.status.value = expense.status;
    form.elements.integrarFinanceiro.checked = expense.integrarFinanceiro !== false;
    form.elements.descricao.value = expense.descricao;
    form.elements.veiculoId.value = expense.veiculoId;
    form.elements.motoristaId.value = expense.motoristaId || "";
    form.elements.valor.value = expense.valor;
    form.elements.dataDespesa.value = expense.dataDespesa || "";
    form.elements.dataVencimento.value = expense.dataVencimento || "";
    form.elements.dataPagamento.value = expense.dataPagamento || "";
    form.elements.observacoes.value = expense.observacoes || "";
    formTitle.textContent = `Editar ${expense.descricao}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderTable() {
    if (expenses.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="9">Nenhuma despesa encontrada para os filtros selecionados.</td></tr>';
      return;
    }

    tableBody.innerHTML = expenses
      .map(
        (expense) => `
          <tr>
            <td>${expense.descricao}</td>
            <td>${createStatusLabel(expense.tipo)}</td>
            <td>${expense.veiculo ? `${expense.veiculo.placa} - ${expense.veiculo.modelo}` : "-"}</td>
            <td>${expense.motorista?.nome || "-"}</td>
            <td>${createFinanceBadge(expense)}</td>
            <td><span class="status-tag">${createStatusLabel(expense.status)}</span></td>
            <td>${expense.dataDespesa || "-"}</td>
            <td>${formatCurrency(expense.valor)}</td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="edit" data-id="${expense.id}">Editar</button>
                <button class="button ghost small danger" type="button" data-action="delete" data-id="${expense.id}">Cancelar</button>
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function refreshList(options = {}) {
    const filters = serializeForm(filterForm);
    const selectedVehicle = form.elements.veiculoId.value;
    const selectedDriver = form.elements.motoristaId.value;
    const query = buildQueryString(filters);
    const response = await requestJson(`/api/financeiro/despesas-veiculos${query ? `?${query}` : ""}`);

    expenses = response.despesas;
    supportData = response.apoio;
    renderSummaryCards(response.resumo);
    renderSupportOptions();
    vehicleFilterSelect.value = filters.veiculoId || "";
    driverFilterSelect.value = filters.motoristaId || "";
    form.elements.veiculoId.value = selectedVehicle || "";
    form.elements.motoristaId.value = selectedDriver || "";
    renderTable();

    if (options.successMessage) {
      setMessage(message, "success", options.successMessage);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = serializeForm(form);
    const expenseId = payload.id;
    delete payload.id;

    if (!payload.motoristaId) {
      delete payload.motoristaId;
    }

    if (!payload.dataVencimento) {
      delete payload.dataVencimento;
    }

    if (!payload.dataPagamento) {
      delete payload.dataPagamento;
    }

    if (!payload.observacoes) {
      delete payload.observacoes;
    }

    payload.integrarFinanceiro = String(form.elements.integrarFinanceiro.checked);

    try {
      const response = expenseId
        ? await requestJson(`/api/financeiro/despesas-veiculos/${expenseId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/financeiro/despesas-veiculos", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      resetForm();
      await refreshList({ successMessage: response.mensagem });
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleTableClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const expense = expenses.find((item) => item.id === button.dataset.id);
    if (!expense) {
      return;
    }

    try {
      if (button.dataset.action === "edit") {
        fillForm(expense);
        return;
      }

      if (button.dataset.action === "delete") {
        if (!window.confirm(`Deseja cancelar a despesa ${expense.descricao}?`)) {
          return;
        }

        const response = await requestJson(`/api/financeiro/despesas-veiculos/${expense.id}`, {
          method: "DELETE",
        });
        resetForm();
        await refreshList({ successMessage: response.mensagem });
      }
    } catch (error) {
      handlePageError(error);
    }
  }

  form.addEventListener("submit", handleSubmit);
  tableBody.addEventListener("click", handleTableClick);
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    refreshList().catch(handlePageError);
  });
  refreshButton.addEventListener("click", () => refreshList().catch(handlePageError));
  clearFiltersButton.addEventListener("click", () => {
    filterForm.reset();
    refreshList().catch(handlePageError);
  });
  newButton.addEventListener("click", () => {
    resetForm();
    setMessage(message, "", "");
  });
  cancelEditButton.addEventListener("click", () => {
    resetForm();
    setMessage(message, "", "");
  });

  resetForm();
  refreshList().catch(handlePageError);
}

document.addEventListener("DOMContentLoaded", createFleetCostApp);
