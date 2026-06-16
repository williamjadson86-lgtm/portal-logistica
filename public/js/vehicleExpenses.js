function createVehicleExpensesApp() {
  const root = document.querySelector("[data-vehicle-expenses-page]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel, formatCurrency } = window.portalUtils;
  const apiBase = root.dataset.apiBase || "/api/despesas-veiculos";
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
  const vehicleFilterSelect = filterForm.querySelector("[name='veiculoId']");
  const driverFilterSelect = filterForm.querySelector("[name='motoristaId']");
  const vehicleSelect = form.querySelector("[name='veiculoId']");
  const driverSelect = form.querySelector("[name='motoristaId']");

  let expenses = [];

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function createFinanceBadge(expense) {
    if (expense.status === "cancelado") {
      return '<span class="status-pill subtle">Cancelada</span>';
    }

    return expense.integrarFinanceiro
      ? '<span class="status-pill">Integrada</span>'
      : '<span class="status-pill subtle">Interna</span>';
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total", valor: formatCurrency(data.totalDespesas) },
      { rotulo: "Pago", valor: formatCurrency(data.totalPago) },
      { rotulo: "Pendente", valor: formatCurrency(data.totalPendente) },
      { rotulo: "Vencidas", valor: data.totalVencidas },
      { rotulo: "Integradas", valor: data.totalIntegradasFinanceiro },
      { rotulo: "Internas", valor: data.totalControleInterno },
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

  function renderSupportOptions(apoio) {
    const veiculos = apoio?.veiculos || [];
    const motoristas = apoio?.motoristas || [];

    vehicleFilterSelect.innerHTML =
      '<option value="">Todos</option>' +
      veiculos
        .map((item) => `<option value="${item.id}">${item.placa} - ${item.modelo}</option>`)
        .join("");
    vehicleSelect.innerHTML =
      '<option value="">Selecione</option>' +
      veiculos
        .map((item) => `<option value="${item.id}">${item.placa} - ${item.modelo}</option>`)
        .join("");
    driverFilterSelect.innerHTML =
      '<option value="">Todos</option>' +
      motoristas.map((item) => `<option value="${item.id}">${item.nome}</option>`).join("");
    driverSelect.innerHTML =
      '<option value="">Nao vincular</option>' +
      motoristas.map((item) => `<option value="${item.id}">${item.nome}</option>`).join("");
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "pendente";
    form.elements.integrarFinanceiro.checked = true;
    formTitle.textContent = "Nova despesa";
    submitButton.textContent = "Salvar despesa";
    cancelEditButton.hidden = true;
  }

  function fillForm(expense) {
    form.elements.id.value = expense.id;
    form.elements.tipo.value = expense.tipo;
    form.elements.status.value = expense.status;
    form.elements.descricao.value = expense.descricao;
    form.elements.veiculoId.value = expense.veiculoId;
    form.elements.motoristaId.value = expense.motoristaId || "";
    form.elements.valor.value = expense.valor;
    form.elements.dataDespesa.value = expense.dataDespesa || "";
    form.elements.dataVencimento.value = expense.dataVencimento || "";
    form.elements.dataPagamento.value = expense.dataPagamento || "";
    form.elements.integrarFinanceiro.checked = expense.integrarFinanceiro !== false;
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
            <td><span class="status-tag">${createStatusLabel(expense.status)}</span></td>
            <td>${createFinanceBadge(expense)}</td>
            <td>${expense.dataDespesa || "-"}</td>
            <td>${formatCurrency(expense.valor)}</td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="edit" data-id="${expense.id}">Editar</button>
                ${
                  expense.status !== "pago" && expense.status !== "cancelado"
                    ? `<button class="button ghost small" type="button" data-action="pay" data-id="${expense.id}">Marcar paga</button>`
                    : ""
                }
                ${
                  expense.status !== "cancelado"
                    ? `<button class="button ghost small danger" type="button" data-action="delete" data-id="${expense.id}">Cancelar</button>`
                    : ""
                }
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function buildQueryString() {
    const query = new URLSearchParams();
    const filters = serializeForm(filterForm);

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        query.set(key, value);
      }
    });

    return query.toString();
  }

  async function refreshList(options = {}) {
    const query = buildQueryString();
    const response = await requestJson(`${apiBase}${query ? `?${query}` : ""}`);
    expenses = response.despesas;
    renderSummaryCards(response.resumo);
    renderSupportOptions(response.apoio);
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
    payload.integrarFinanceiro = form.elements.integrarFinanceiro.checked;

    try {
      const response = expenseId
        ? await requestJson(`${apiBase}/${expenseId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson(apiBase, {
            method: "POST",
            body: JSON.stringify(payload),
          });

      resetForm();
      await refreshList({ successMessage: response.mensagem });
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleTableAction(event) {
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

      if (button.dataset.action === "pay") {
        const response = await requestJson(`${apiBase}/${expense.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "pago" }),
        });
        await refreshList({ successMessage: response.mensagem });
        return;
      }

      if (button.dataset.action === "delete") {
        if (!window.confirm(`Deseja cancelar a despesa ${expense.descricao}?`)) {
          return;
        }

        const response = await requestJson(`${apiBase}/${expense.id}`, {
          method: "DELETE",
        });
        resetForm();
        await refreshList({ successMessage: response.mensagem });
      }
    } catch (error) {
      handlePageError(error);
    }
  }

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    refreshList().catch(handlePageError);
  });
  form.addEventListener("submit", handleSubmit);
  tableBody.addEventListener("click", handleTableAction);
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

document.addEventListener("DOMContentLoaded", createVehicleExpensesApp);
