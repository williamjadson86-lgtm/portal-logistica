function createFleetCostApp() {
  const root = document.querySelector("[data-fleet-cost-page]");
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
      { rotulo: "Despesa total", valor: formatCurrency(data.totalDespesas) },
      { rotulo: "Pago", valor: formatCurrency(data.totalPago) },
      { rotulo: "Pendente", valor: formatCurrency(data.totalPendente) },
      { rotulo: "Vencidas", valor: data.totalVencidas },
      { rotulo: "Integradas", valor: data.totalIntegradasFinanceiro },
      { rotulo: "Nao integradas", valor: data.totalControleInterno },
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
    const response = await requestJson(`/api/custos-frota${query ? `?${query}` : ""}`);

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
        ? await requestJson(`/api/custos-frota/${expenseId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/custos-frota", {
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

        const response = await requestJson(`/api/custos-frota/${expense.id}`, {
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
