function createClientsApp() {
  const root = document.querySelector("[data-clients-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel } = window.portalUtils;
  const message = document.querySelector("[data-client-message]");
  const summary = document.querySelector("[data-client-summary]");
  const form = document.querySelector("[data-client-form]");
  const formTitle = document.querySelector("[data-form-title]");
  const submitButton = document.querySelector("[data-submit-button]");
  const cancelEditButton = document.querySelector("[data-cancel-edit-button]");
  const tableBody = document.querySelector("[data-clients-table-body]");
  const details = document.querySelector("[data-client-details]");
  const statusForm = document.querySelector("[data-client-status-form]");
  const statusQuickSelect = statusForm.querySelector("[name='status']");
  const refreshButton = document.querySelector("[data-refresh-button]");
  const newButton = document.querySelector("[data-new-client-button]");

  let clients = [];
  let selectedClientId = null;

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function findClient(id) {
    return clients.find((client) => client.id === id) || null;
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total de clientes", valor: data.totalClientes },
      { rotulo: "Ativos", valor: data.ativos },
      { rotulo: "Inativos", valor: data.inativos },
      { rotulo: "Bloqueados", valor: data.bloqueados },
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

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "ativo";
    formTitle.textContent = "Novo cliente";
    submitButton.textContent = "Salvar cliente";
    cancelEditButton.hidden = true;
  }

  function fillForm(client) {
    form.elements.id.value = client.id;
    form.elements.nome.value = client.nome;
    form.elements.documento.value = client.documento;
    form.elements.email.value = client.email;
    form.elements.telefone.value = client.telefone;
    form.elements.contatoNome.value = client.contatoNome;
    form.elements.cidade.value = client.cidade;
    form.elements.estado.value = client.estado;
    form.elements.endereco.value = client.endereco;
    form.elements.status.value = client.status;
    form.elements.observacoes.value = client.observacoes || "";
    formTitle.textContent = `Editar ${client.nome}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderDetails(client) {
    if (!client) {
      details.className = "delivery-details empty";
      details.textContent = "Selecione um cliente para visualizar os detalhes comerciais.";
      statusQuickSelect.value = "ativo";
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>Nome</span><strong>${client.nome}</strong></div>
        <div><span>Status</span><strong>${createStatusLabel(client.status)}</strong></div>
        <div><span>Documento</span><strong>${client.documento}</strong></div>
        <div><span>Contato principal</span><strong>${client.contatoNome}</strong></div>
        <div><span>Email</span><strong>${client.email}</strong></div>
        <div><span>Telefone</span><strong>${client.telefone}</strong></div>
        <div><span>Cidade / UF</span><strong>${client.cidade} / ${client.estado}</strong></div>
        <div><span>Endereco</span><strong>${client.endereco}</strong></div>
        <div><span>Observacoes</span><strong>${client.observacoes || "Sem observacoes"}</strong></div>
      </div>
    `;
    statusQuickSelect.value = client.status;
  }

  function renderTable() {
    if (clients.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7">Nenhum cliente cadastrado.</td></tr>';
      return;
    }

    tableBody.innerHTML = clients
      .map(
        (client) => `
          <tr>
            <td>${client.nome}</td>
            <td>${client.documento}</td>
            <td>${client.contatoNome}</td>
            <td>${client.email}</td>
            <td>${client.cidade}/${client.estado}</td>
            <td><span class="status-tag">${createStatusLabel(client.status)}</span></td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="view" data-id="${client.id}">Visualizar</button>
                <button class="button ghost small" type="button" data-action="edit" data-id="${client.id}">Editar</button>
                <button class="button ghost small" type="button" data-action="status" data-id="${client.id}">Atualizar status</button>
                <button class="button ghost small danger" type="button" data-action="delete" data-id="${client.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function loadDetails(clientId) {
    const response = await requestJson(`/api/clientes/${clientId}`);
    selectedClientId = response.cliente.id;
    renderDetails(response.cliente);
    return response.cliente;
  }

  async function refreshList(options = {}) {
    const response = await requestJson("/api/clientes");
    clients = response.clientes;
    renderSummaryCards(response.resumo);
    renderTable();

    if (selectedClientId) {
      const selected = findClient(selectedClientId);
      renderDetails(selected);
      if (!selected) {
        selectedClientId = null;
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
    const clientId = payload.id;
    delete payload.id;
    payload.estado = payload.estado.toUpperCase();

    try {
      const response = clientId
        ? await requestJson(`/api/clientes/${clientId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/clientes", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      selectedClientId = response.cliente.id;
      resetForm();
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedClientId);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (!selectedClientId) {
      setMessage(message, "error", "Selecione um cliente antes de atualizar o status.");
      return;
    }

    try {
      const response = await requestJson(`/api/clientes/${selectedClientId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusQuickSelect.value }),
      });
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedClientId);
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
        const client = findClient(id) || (await loadDetails(id));
        if (!window.confirm(`Deseja realmente excluir o cliente ${client.nome}?`)) {
          return;
        }

        const response = await requestJson(`/api/clientes/${id}`, { method: "DELETE" });
        if (selectedClientId === id) {
          selectedClientId = null;
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

document.addEventListener("DOMContentLoaded", createClientsApp);
