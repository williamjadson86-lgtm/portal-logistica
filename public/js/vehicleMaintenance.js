function createVehicleMaintenanceApp() {
  const root = document.querySelector("[data-vehicle-maintenance-page]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel, formatCurrency } =
    window.portalUtils;
  const message = document.querySelector("[data-vehicle-maintenance-message]");
  const summary = document.querySelector("[data-vehicle-maintenance-summary]");
  const filterForm = document.querySelector("[data-vehicle-maintenance-filter-form]");
  const form = document.querySelector("[data-vehicle-maintenance-form]");
  const formTitle = document.querySelector("[data-vehicle-maintenance-form-title]");
  const submitButton = document.querySelector("[data-vehicle-maintenance-submit-button]");
  const cancelEditButton = document.querySelector("[data-vehicle-maintenance-cancel-edit-button]");
  const refreshButton = document.querySelector("[data-vehicle-maintenance-refresh-button]");
  const clearFiltersButton = document.querySelector("[data-vehicle-maintenance-clear-filters-button]");
  const newButton = document.querySelector("[data-vehicle-maintenance-new-button]");
  const tableBody = document.querySelector("[data-vehicle-maintenance-table-body]");
  const vehicleFilterSelect = document.querySelector(
    "[data-vehicle-maintenance-filter-form] [name='veiculoId']",
  );
  const vehicleSelect = document.querySelector("[data-vehicle-maintenance-form] [name='veiculoId']");

  let maintenances = [];
  let supportData = { veiculos: [] };

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

  function createFinanceBadge(maintenance) {
    if (maintenance.status === "cancelada") {
      return '<span class="status-tag status-tag--danger">Cancelada</span>';
    }

    if (maintenance.integrarFinanceiro) {
      return '<span class="status-tag status-tag--success">Integrada</span>';
    }

    return '<span class="status-tag status-tag--neutral">Nao integrada</span>';
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Custo total", valor: formatCurrency(data.totalCusto) },
      { rotulo: "Registros", valor: data.totalRegistros },
      { rotulo: "Agendadas", valor: data.agendadas },
      { rotulo: "Em execucao", valor: data.emExecucao },
      { rotulo: "Concluidas", valor: data.concluidas },
      { rotulo: "Vencidas", valor: data.manutencoesVencidas },
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

    vehicleFilterSelect.innerHTML = `<option value="">Todos os veiculos</option>${vehicleOptions}`;
    vehicleSelect.innerHTML = `<option value="">Selecione um veiculo</option>${vehicleOptions}`;
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "agendada";
    form.elements.integrarFinanceiro.checked = true;
    form.elements.dataManutencao.value = new Date().toISOString().slice(0, 10);
    formTitle.textContent = "Nova manutencao";
    submitButton.textContent = "Salvar manutencao";
    cancelEditButton.hidden = true;
  }

  function fillForm(maintenance) {
    form.elements.id.value = maintenance.id;
    form.elements.tipo.value = maintenance.tipo;
    form.elements.status.value = maintenance.status;
    form.elements.integrarFinanceiro.checked = maintenance.integrarFinanceiro !== false;
    form.elements.descricao.value = maintenance.descricao;
    form.elements.veiculoId.value = maintenance.veiculoId;
    form.elements.custo.value = maintenance.custo;
    form.elements.dataManutencao.value = maintenance.dataManutencao || "";
    form.elements.proximaManutencao.value = maintenance.proximaManutencao || "";
    form.elements.observacoes.value = maintenance.observacoes || "";
    formTitle.textContent = `Editar ${maintenance.descricao}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderTable() {
    if (maintenances.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="9">Nenhuma manutencao encontrada para os filtros selecionados.</td></tr>';
      return;
    }

    tableBody.innerHTML = maintenances
      .map(
        (maintenance) => `
          <tr>
            <td>${maintenance.descricao}</td>
            <td>${createStatusLabel(maintenance.tipo)}</td>
            <td>${maintenance.veiculo ? `${maintenance.veiculo.placa} - ${maintenance.veiculo.modelo}` : "-"}</td>
            <td>${createFinanceBadge(maintenance)}</td>
            <td><span class="status-tag">${createStatusLabel(maintenance.status)}</span></td>
            <td>${maintenance.dataManutencao || "-"}</td>
            <td>${maintenance.proximaManutencao || "-"}</td>
            <td>${formatCurrency(maintenance.custo)}</td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="edit" data-id="${maintenance.id}">Editar</button>
                <button class="button ghost small danger" type="button" data-action="delete" data-id="${maintenance.id}">Cancelar</button>
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
    const query = buildQueryString(filters);
    const response = await requestJson(`/api/manutencoes-veiculos${query ? `?${query}` : ""}`);

    maintenances = response.manutencoes;
    supportData = response.apoio;
    renderSummaryCards(response.resumo);
    renderSupportOptions();
    vehicleFilterSelect.value = filters.veiculoId || "";
    form.elements.veiculoId.value = selectedVehicle || "";
    renderTable();

    if (options.successMessage) {
      setMessage(message, "success", options.successMessage);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = serializeForm(form);
    const maintenanceId = payload.id;
    delete payload.id;

    if (!payload.proximaManutencao) {
      delete payload.proximaManutencao;
    }

    if (!payload.observacoes) {
      delete payload.observacoes;
    }

    payload.integrarFinanceiro = String(form.elements.integrarFinanceiro.checked);

    try {
      const response = maintenanceId
        ? await requestJson(`/api/manutencoes-veiculos/${maintenanceId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/manutencoes-veiculos", {
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

    const maintenance = maintenances.find((item) => item.id === button.dataset.id);
    if (!maintenance) {
      return;
    }

    try {
      if (button.dataset.action === "edit") {
        fillForm(maintenance);
        return;
      }

      if (button.dataset.action === "delete") {
        if (!window.confirm(`Deseja cancelar a manutencao ${maintenance.descricao}?`)) {
          return;
        }

        const response = await requestJson(`/api/manutencoes-veiculos/${maintenance.id}`, {
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

document.addEventListener("DOMContentLoaded", createVehicleMaintenanceApp);
