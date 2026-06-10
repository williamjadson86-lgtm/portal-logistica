function createDriversApp() {
  const root = document.querySelector("[data-drivers-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel } = window.portalUtils;
  const message = document.querySelector("[data-driver-message]");
  const summary = document.querySelector("[data-driver-summary]");
  const form = document.querySelector("[data-driver-form]");
  const formTitle = document.querySelector("[data-form-title]");
  const submitButton = document.querySelector("[data-submit-button]");
  const cancelEditButton = document.querySelector("[data-cancel-edit-button]");
  const tableBody = document.querySelector("[data-drivers-table-body]");
  const details = document.querySelector("[data-driver-details]");
  const statusForm = document.querySelector("[data-driver-status-form]");
  const statusQuickSelect = statusForm.querySelector("[name='status']");
  const refreshButton = document.querySelector("[data-refresh-button]");
  const newButton = document.querySelector("[data-new-driver-button]");

  let drivers = [];
  let selectedDriverId = null;

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }
    setMessage(message, "error", error.message);
  }

  function findDriver(id) {
    return drivers.find((driver) => driver.id === id) || null;
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total de motoristas", valor: data.totalMotoristas },
      { rotulo: "Ativos", valor: data.ativos },
      { rotulo: "Inativos", valor: data.inativos },
      { rotulo: "Afastados", valor: data.afastados },
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
    form.elements.status.value = "ativo";
    form.elements.categoriaCnh.value = "B";
    formTitle.textContent = "Novo motorista";
    submitButton.textContent = "Salvar motorista";
    cancelEditButton.hidden = true;
  }

  function fillForm(driver) {
    form.elements.id.value = driver.id;
    form.elements.nome.value = driver.nome;
    form.elements.cpf.value = driver.cpf;
    form.elements.cnh.value = driver.cnh;
    form.elements.categoriaCnh.value = driver.categoriaCnh;
    form.elements.validadeCnh.value = driver.validadeCnh;
    form.elements.telefone.value = driver.telefone;
    form.elements.status.value = driver.status;
    formTitle.textContent = `Editar ${driver.nome}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderDetails(driver) {
    if (!driver) {
      details.className = "delivery-details empty";
      details.textContent = "Selecione um motorista para visualizar os detalhes operacionais.";
      statusQuickSelect.value = "ativo";
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>Nome</span><strong>${driver.nome}</strong></div>
        <div><span>Status</span><strong>${createStatusLabel(driver.status)}</strong></div>
        <div><span>CPF</span><strong>${driver.cpf}</strong></div>
        <div><span>CNH</span><strong>${driver.cnh}</strong></div>
        <div><span>Categoria</span><strong>${driver.categoriaCnh}</strong></div>
        <div><span>Validade CNH</span><strong>${driver.validadeCnh}</strong></div>
        <div><span>Telefone</span><strong>${driver.telefone}</strong></div>
      </div>
    `;
    statusQuickSelect.value = driver.status;
  }

  function renderTable() {
    if (drivers.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8">Nenhum motorista cadastrado.</td></tr>';
      return;
    }

    tableBody.innerHTML = drivers.map((driver) => `
      <tr>
        <td>${driver.nome}</td>
        <td>${driver.cpf}</td>
        <td>${driver.cnh}</td>
        <td>${driver.categoriaCnh}</td>
        <td>${driver.validadeCnh}</td>
        <td>${driver.telefone}</td>
        <td><span class="status-tag">${createStatusLabel(driver.status)}</span></td>
        <td>
          <div class="row-actions">
            <button class="button ghost small" type="button" data-action="view" data-id="${driver.id}">Visualizar</button>
            <button class="button ghost small" type="button" data-action="edit" data-id="${driver.id}">Editar</button>
            <button class="button ghost small" type="button" data-action="status" data-id="${driver.id}">Atualizar status</button>
            <button class="button ghost small danger" type="button" data-action="delete" data-id="${driver.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function loadDetails(driverId) {
    const response = await requestJson(`/api/motoristas/${driverId}`);
    selectedDriverId = response.motorista.id;
    renderDetails(response.motorista);
    return response.motorista;
  }

  async function refreshList(options = {}) {
    const response = await requestJson("/api/motoristas");
    drivers = response.motoristas;
    renderSummaryCards(response.resumo);
    renderTable();

    if (selectedDriverId) {
      const selected = findDriver(selectedDriverId);
      renderDetails(selected);
      if (!selected) {
        selectedDriverId = null;
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
    const driverId = payload.id;
    delete payload.id;

    try {
      const response = driverId
        ? await requestJson(`/api/motoristas/${driverId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/motoristas", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      selectedDriverId = response.motorista.id;
      resetForm();
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedDriverId);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (!selectedDriverId) {
      setMessage(message, "error", "Selecione um motorista antes de atualizar o status.");
      return;
    }

    try {
      const response = await requestJson(`/api/motoristas/${selectedDriverId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusQuickSelect.value }),
      });
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedDriverId);
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
        const driver = findDriver(id) || (await loadDetails(id));
        if (!window.confirm(`Deseja realmente excluir o motorista ${driver.nome}?`)) {
          return;
        }
        const response = await requestJson(`/api/motoristas/${id}`, { method: "DELETE" });
        if (selectedDriverId === id) {
          selectedDriverId = null;
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

document.addEventListener("DOMContentLoaded", createDriversApp);
