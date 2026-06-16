function createVehiclesApp() {
  const root = document.querySelector("[data-vehicles-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel, formatCurrency } = window.portalUtils;
  const message = document.querySelector("[data-vehicle-message]");
  const summary = document.querySelector("[data-vehicle-summary]");
  const form = document.querySelector("[data-vehicle-form]");
  const formTitle = document.querySelector("[data-form-title]");
  const submitButton = document.querySelector("[data-submit-button]");
  const cancelEditButton = document.querySelector("[data-cancel-edit-button]");
  const tableBody = document.querySelector("[data-vehicles-table-body]");
  const details = document.querySelector("[data-vehicle-details]");
  const expenseSummary = document.querySelector("[data-vehicle-expense-summary]");
  const expenseList = document.querySelector("[data-vehicle-expense-list]");
  const statusForm = document.querySelector("[data-vehicle-status-form]");
  const statusQuickSelect = statusForm.querySelector("[name='status']");
  const refreshButton = document.querySelector("[data-refresh-button]");
  const newButton = document.querySelector("[data-new-vehicle-button]");

  let vehicles = [];
  let selectedVehicleId = null;

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }
    setMessage(message, "error", error.message);
  }

  function findVehicle(id) {
    return vehicles.find((vehicle) => vehicle.id === id) || null;
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total de veiculos", valor: data.totalVeiculos },
      { rotulo: "Disponiveis", valor: data.disponiveis },
      { rotulo: "Em rota", valor: data.emRota },
      { rotulo: "Manutencao", valor: data.manutencao },
      { rotulo: "Inativos", valor: data.inativos },
    ];

    summary.innerHTML = cards.map((item) => `
      <article class="stat-card compact">
        <span>${item.rotulo}</span>
        <strong>${item.valor}</strong>
      </article>
    `).join("");
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "disponivel";
    formTitle.textContent = "Novo veiculo";
    submitButton.textContent = "Salvar veiculo";
    cancelEditButton.hidden = true;
  }

  function fillForm(vehicle) {
    form.elements.id.value = vehicle.id;
    form.elements.placa.value = vehicle.placa;
    form.elements.modelo.value = vehicle.modelo;
    form.elements.tipo.value = vehicle.tipo;
    form.elements.capacidade.value = vehicle.capacidade;
    form.elements.ano.value = vehicle.ano;
    form.elements.status.value = vehicle.status;
    formTitle.textContent = `Editar ${vehicle.placa}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderDetails(vehicle) {
    if (!vehicle) {
      details.className = "delivery-details empty";
      details.textContent = "Selecione um veiculo para visualizar os detalhes da frota.";
      expenseSummary.innerHTML = "";
      expenseList.textContent = "Selecione um veiculo para consultar despesas relacionadas.";
      statusQuickSelect.value = "disponivel";
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>Placa</span><strong>${vehicle.placa}</strong></div>
        <div><span>Status</span><strong>${createStatusLabel(vehicle.status)}</strong></div>
        <div><span>Modelo</span><strong>${vehicle.modelo}</strong></div>
        <div><span>Tipo</span><strong>${vehicle.tipo}</strong></div>
        <div><span>Capacidade</span><strong>${vehicle.capacidade}</strong></div>
        <div><span>Ano</span><strong>${vehicle.ano}</strong></div>
      </div>
    `;
    statusQuickSelect.value = vehicle.status;
  }

  function renderVehicleExpenses(payload) {
    if (!payload || !Array.isArray(payload.despesas) || payload.despesas.length === 0) {
      expenseSummary.innerHTML = `
        <article class="stat-card compact">
          <span>Total de despesas</span>
          <strong>0</strong>
        </article>
      `;
      expenseList.innerHTML = `
        <article class="data-card empty">
          <strong>Sem despesas vinculadas</strong>
          <p>Este veiculo ainda nao possui despesas ativas no periodo atual.</p>
        </article>
      `;
      return;
    }

    expenseSummary.innerHTML = [
      { rotulo: "Total de despesas", valor: payload.resumo.totalDespesas },
      { rotulo: "Valor total", valor: formatCurrency(payload.resumo.valorTotal) },
      { rotulo: "Pago", valor: formatCurrency(payload.resumo.totalPago) },
      { rotulo: "Pendente", valor: formatCurrency(payload.resumo.totalPendente) },
    ]
      .map(
        (item) => `
          <article class="stat-card compact">
            <span>${item.rotulo}</span>
            <strong>${item.valor}</strong>
          </article>
        `,
      )
      .join("");

    expenseList.innerHTML = payload.despesas
      .slice(0, 5)
      .map(
        (item) => `
          <article class="data-card">
            <div class="data-card-top">
              <div>
                <h3>${item.descricao}</h3>
                <p>${item.tipo} | ${item.dataDespesa || "Sem data"}</p>
              </div>
              <span class="status-tag">${createStatusLabel(item.status)}</span>
            </div>
            <strong>${formatCurrency(item.valor)}</strong>
            <p>${item.motorista?.nome || "Sem motorista vinculado"}</p>
          </article>
        `,
      )
      .join("");
  }

  function renderTable() {
    if (vehicles.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7">Nenhum veiculo cadastrado.</td></tr>';
      return;
    }

    tableBody.innerHTML = vehicles.map((vehicle) => `
      <tr>
        <td>${vehicle.placa}</td>
        <td>${vehicle.modelo}</td>
        <td>${vehicle.tipo}</td>
        <td>${vehicle.capacidade}</td>
        <td>${vehicle.ano}</td>
        <td><span class="status-tag">${createStatusLabel(vehicle.status)}</span></td>
        <td>
          <div class="row-actions">
            <button class="button ghost small" type="button" data-action="view" data-id="${vehicle.id}">Visualizar</button>
            <button class="button ghost small" type="button" data-action="edit" data-id="${vehicle.id}">Editar</button>
            <button class="button ghost small" type="button" data-action="status" data-id="${vehicle.id}">Atualizar status</button>
            <button class="button ghost small danger" type="button" data-action="delete" data-id="${vehicle.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function loadDetails(vehicleId) {
    const [vehicleResponse, expensesResponse] = await Promise.all([
      requestJson(`/api/veiculos/${vehicleId}`),
      requestJson(`/api/veiculos/${vehicleId}/despesas`),
    ]);
    selectedVehicleId = vehicleResponse.veiculo.id;
    renderDetails(vehicleResponse.veiculo);
    renderVehicleExpenses(expensesResponse);
    return vehicleResponse.veiculo;
  }

  async function refreshList(options = {}) {
    const response = await requestJson("/api/veiculos");
    vehicles = response.veiculos;
    renderSummaryCards(response.resumo);
    renderTable();

    if (selectedVehicleId) {
      const selected = findVehicle(selectedVehicleId);
      renderDetails(selected);
      if (!selected) {
        selectedVehicleId = null;
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
    const vehicleId = payload.id;
    delete payload.id;

    try {
      const response = vehicleId
        ? await requestJson(`/api/veiculos/${vehicleId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/veiculos", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      selectedVehicleId = response.veiculo.id;
      resetForm();
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedVehicleId);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (!selectedVehicleId) {
      setMessage(message, "error", "Selecione um veiculo antes de atualizar o status.");
      return;
    }

    try {
      const response = await requestJson(`/api/veiculos/${selectedVehicleId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusQuickSelect.value }),
      });
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedVehicleId);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleRowAction(event) {
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
        const vehicle = findVehicle(id) || (await loadDetails(id));
        if (!window.confirm(`Deseja realmente excluir o veiculo ${vehicle.placa}?`)) {
          return;
        }
        const response = await requestJson(`/api/veiculos/${id}`, { method: "DELETE" });
        if (selectedVehicleId === id) {
          selectedVehicleId = null;
          renderDetails(null);
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
  tableBody.addEventListener("click", handleRowAction);
  refreshButton.addEventListener("click", () => refreshList().catch(handlePageError));
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

document.addEventListener("DOMContentLoaded", createVehiclesApp);
