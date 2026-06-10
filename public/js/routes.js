function createRoutesApp() {
  const root = document.querySelector("[data-routes-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel } = window.portalUtils;
  const message = document.querySelector("[data-route-message]");
  const summary = document.querySelector("[data-route-summary]");
  const form = document.querySelector("[data-route-form]");
  const formTitle = document.querySelector("[data-form-title]");
  const submitButton = document.querySelector("[data-submit-button]");
  const cancelEditButton = document.querySelector("[data-cancel-edit-button]");
  const motoristaSelect = form.querySelector("[name='motoristaId']");
  const veiculoSelect = form.querySelector("[name='veiculoId']");
  const details = document.querySelector("[data-route-details]");
  const availableDeliveries = document.querySelector("[data-available-deliveries]");
  const linkedDeliveries = document.querySelector("[data-linked-deliveries]");
  const tableBody = document.querySelector("[data-routes-table-body]");
  const linkForm = document.querySelector("[data-link-deliveries-form]");
  const refreshButton = document.querySelector("[data-refresh-button]");
  const newRouteButton = document.querySelector("[data-new-route-button]");
  const routeActions = Array.from(document.querySelectorAll("[data-route-action]"));

  let routes = [];
  let support = { motoristas: [], veiculos: [], entregasDisponiveis: [] };
  let selectedRoute = null;

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total de rotas", valor: data.totalRotas },
      { rotulo: "Planejadas", valor: data.planejadas },
      { rotulo: "Em andamento", valor: data.emAndamento },
      { rotulo: "Concluidas", valor: data.concluidas },
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

  function setOptions(select, items, getLabel, placeholder, selectedValue = "") {
    const options = [`<option value="">${placeholder}</option>`];
    for (const item of items) {
      const selected = item.id === selectedValue ? " selected" : "";
      options.push(`<option value="${item.id}"${selected}>${getLabel(item)}</option>`);
    }
    select.innerHTML = options.join("");
  }

  function ensureSelectedOption(select, value, label) {
    if (!value) {
      return;
    }

    if ([...select.options].some((option) => option.value === value)) {
      return;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = true;
    select.appendChild(option);
  }

  function renderSupportOptions(route = null) {
    setOptions(
      motoristaSelect,
      support.motoristas,
      (item) => item.nome,
      "Selecione um motorista",
      route?.motoristaId || "",
    );
    setOptions(
      veiculoSelect,
      support.veiculos,
      (item) => `${item.placa} - ${item.modelo}`,
      "Selecione um veiculo",
      route?.veiculoId || "",
    );

    if (route?.motoristaId) {
      ensureSelectedOption(motoristaSelect, route.motoristaId, route.motoristaNome);
    }

    if (route?.veiculoId) {
      ensureSelectedOption(veiculoSelect, route.veiculoId, route.veiculoPlaca);
    }
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    formTitle.textContent = "Nova rota";
    submitButton.textContent = "Salvar rota";
    cancelEditButton.hidden = true;
    renderSupportOptions();
  }

  function fillForm(route) {
    form.elements.id.value = route.id;
    form.elements.codigo.value = route.codigo;
    form.elements.dataRota.value = route.dataRota;
    form.elements.origem.value = route.origem;
    form.elements.destino.value = route.destino;
    form.elements.observacoes.value = route.observacoes || "";
    formTitle.textContent = `Editar ${route.codigo}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
    renderSupportOptions(route);
  }

  function renderDetails(route) {
    selectedRoute = route;

    if (!route) {
      details.className = "delivery-details empty";
      details.textContent =
        "Selecione uma rota para visualizar os detalhes e executar as acoes operacionais.";
      linkedDeliveries.innerHTML = `
        <article class="data-card empty">
          <h3>Nenhuma rota selecionada</h3>
          <p>Escolha uma rota para ver as entregas vinculadas.</p>
        </article>
      `;
      availableDeliveries.innerHTML = `
        <article class="data-card empty">
          <h3>Selecione uma rota planejada</h3>
          <p>As entregas disponiveis aparecerao aqui para vinculacao.</p>
        </article>
      `;
      updateActionButtons(null);
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>Codigo</span><strong>${route.codigo}</strong></div>
        <div><span>Status</span><strong>${createStatusLabel(route.status)}</strong></div>
        <div><span>Motorista</span><strong>${route.motoristaNome}</strong></div>
        <div><span>Veiculo</span><strong>${route.veiculoPlaca}</strong></div>
        <div><span>Origem</span><strong>${route.origem}</strong></div>
        <div><span>Destino</span><strong>${route.destino}</strong></div>
        <div><span>Data da rota</span><strong>${route.dataRota}</strong></div>
        <div><span>Entregas ativas</span><strong>${route.totalEntregasAtivas}</strong></div>
        <div><span>Observacoes</span><strong>${route.observacoes || "Sem observacoes"}</strong></div>
      </div>
    `;

    renderLinkedDeliveries(route);
    renderAvailableDeliveries(route);
    updateActionButtons(route);
  }

  function renderAvailableDeliveries(route) {
    if (!route || route.status !== "planejada") {
      availableDeliveries.innerHTML = `
        <article class="data-card empty">
          <h3>Vinculacao indisponivel</h3>
          <p>Somente rotas planejadas aceitam novas entregas.</p>
        </article>
      `;
      return;
    }

    if (support.entregasDisponiveis.length === 0) {
      availableDeliveries.innerHTML = `
        <article class="data-card empty">
          <h3>Sem entregas disponiveis</h3>
          <p>Nao ha entregas elegiveis para vinculo neste momento.</p>
        </article>
      `;
      return;
    }

    availableDeliveries.innerHTML = support.entregasDisponiveis
      .map(
        (delivery) => `
          <label class="selection-item">
            <input type="checkbox" name="entregaIds" value="${delivery.id}" />
            <div>
              <strong>${delivery.codigo}</strong>
              <span>${delivery.cliente} | ${createStatusLabel(delivery.status)}</span>
              <p>Previsao ${delivery.dataPrevista || "nao informada"}</p>
            </div>
          </label>
        `,
      )
      .join("");
  }

  function renderLinkedDeliveries(route) {
    if (!route.entregas || route.entregas.length === 0) {
      linkedDeliveries.innerHTML = `
        <article class="data-card empty">
          <h3>Nenhuma entrega vinculada</h3>
          <p>Esta rota ainda nao possui entregas associadas.</p>
        </article>
      `;
      return;
    }

    linkedDeliveries.innerHTML = route.entregas
      .map(
        (delivery) => `
          <article class="data-card">
            <div class="data-card-top">
              <div>
                <h3>${delivery.codigo}</h3>
                <p>${delivery.cliente} | ${delivery.origem} -> ${delivery.destino}</p>
              </div>
              <span class="status-tag">${createStatusLabel(delivery.status)}</span>
            </div>
            <strong>${delivery.ativo ? "Vinculo ativo" : "Historico liberado"}</strong>
            <p>Previsao ${delivery.dataPrevista || "nao informada"} | ${delivery.cidade}/${delivery.estado}</p>
            ${
              delivery.ativo && route.status === "planejada"
                ? `
                <div class="row-actions">
                  <button
                    class="button ghost small danger"
                    type="button"
                    data-remove-delivery="${delivery.id}"
                  >
                    Remover entrega
                  </button>
                </div>
              `
                : ""
            }
          </article>
        `,
      )
      .join("");
  }

  function updateActionButtons(route) {
    for (const button of routeActions) {
      if (!route) {
        button.disabled = true;
        continue;
      }

      if (button.dataset.routeAction === "start") {
        button.disabled = route.status !== "planejada";
        continue;
      }

      if (button.dataset.routeAction === "complete") {
        button.disabled = route.status !== "em_andamento";
        continue;
      }

      if (button.dataset.routeAction === "cancel") {
        button.disabled = !["planejada", "em_andamento"].includes(route.status);
      }
    }
  }

  function renderTable() {
    if (routes.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9">Nenhuma rota cadastrada.</td></tr>`;
      return;
    }

    tableBody.innerHTML = routes
      .map(
        (route) => `
          <tr>
            <td>${route.codigo}</td>
            <td>${route.motoristaNome || "-"}</td>
            <td>${route.veiculoPlaca || "-"}</td>
            <td>${route.origem}</td>
            <td>${route.destino}</td>
            <td>${route.dataRota}</td>
            <td><span class="status-tag">${createStatusLabel(route.status)}</span></td>
            <td>${route.totalEntregasAtivas}</td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="view" data-id="${route.id}">Visualizar</button>
                <button class="button ghost small" type="button" data-action="edit" data-id="${route.id}">Editar</button>
                <button class="button ghost small" type="button" data-action="start" data-id="${route.id}">Iniciar</button>
                <button class="button ghost small" type="button" data-action="complete" data-id="${route.id}">Concluir</button>
                <button class="button ghost small danger" type="button" data-action="cancel" data-id="${route.id}">Cancelar</button>
                <button class="button ghost small danger" type="button" data-action="delete" data-id="${route.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function refreshList(options = {}) {
    const response = await requestJson("/api/rotas");
    routes = response.rotas;
    support = response.apoio;
    renderSummaryCards(response.resumo);
    renderSupportOptions(selectedRoute);
    renderTable();

    if (selectedRoute?.id) {
      await loadDetails(selectedRoute.id);
    } else {
      renderDetails(null);
    }

    if (options.successMessage) {
      setMessage(message, "success", options.successMessage);
    }
  }

  async function loadDetails(routeId) {
    const response = await requestJson(`/api/rotas/${routeId}`);
    support = response.apoio;
    renderSupportOptions(response.rota);
    renderDetails(response.rota);
    return response.rota;
  }

  async function submitRoute(event) {
    event.preventDefault();
    const payload = serializeForm(form);
    const routeId = payload.id;
    delete payload.id;

    try {
      const response = routeId
        ? await requestJson(`/api/rotas/${routeId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson("/api/rotas", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      support = response.apoio;
      resetForm();
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(response.rota.id);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleLinkDeliveries(event) {
    event.preventDefault();

    if (!selectedRoute?.id || selectedRoute.status !== "planejada") {
      setMessage(message, "error", "Selecione uma rota planejada para vincular entregas.");
      return;
    }

    const entregaIds = [
      ...availableDeliveries.querySelectorAll("input[name='entregaIds']:checked"),
    ].map((input) => input.value);

    if (entregaIds.length === 0) {
      setMessage(message, "error", "Selecione ao menos uma entrega para vincular.");
      return;
    }

    try {
      const response = await requestJson(`/api/rotas/${selectedRoute.id}/entregas`, {
        method: "POST",
        body: JSON.stringify({ entregaIds }),
      });

      support = response.apoio;
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(response.rota.id);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function executeRouteAction(action, routeId) {
    const labels = {
      start: "iniciar",
      complete: "concluir",
      cancel: "cancelar",
      delete: "excluir",
    };

    if (!window.confirm(`Deseja realmente ${labels[action]} esta rota?`)) {
      return;
    }

    const endpointMap = {
      start: { url: `/api/rotas/${routeId}/iniciar`, method: "PATCH" },
      complete: { url: `/api/rotas/${routeId}/concluir`, method: "PATCH" },
      cancel: { url: `/api/rotas/${routeId}/cancelar`, method: "PATCH" },
      delete: { url: `/api/rotas/${routeId}`, method: "DELETE" },
    };

    const endpoint = endpointMap[action];
    const response = await requestJson(endpoint.url, { method: endpoint.method });

    if (action === "delete") {
      if (selectedRoute?.id === routeId) {
        selectedRoute = null;
      }
      resetForm();
      await refreshList({ successMessage: response.mensagem });
      return;
    }

    support = response.apoio;
    await refreshList({ successMessage: response.mensagem });
    await loadDetails(routeId);
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
        const route = await loadDetails(id);
        fillForm(route);
        return;
      }

      await executeRouteAction(action, id);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleDetailAction(event) {
    const button = event.target.closest("[data-route-action]");
    if (!button || !selectedRoute?.id) {
      return;
    }

    const actionMap = {
      start: "start",
      complete: "complete",
      cancel: "cancel",
    };

    try {
      await executeRouteAction(actionMap[button.dataset.routeAction], selectedRoute.id);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleLinkedDeliveryAction(event) {
    const button = event.target.closest("[data-remove-delivery]");
    if (!button || !selectedRoute?.id) {
      return;
    }

    const entregaId = button.dataset.removeDelivery;

    if (!window.confirm("Deseja remover esta entrega da rota?")) {
      return;
    }

    try {
      const response = await requestJson(
        `/api/rotas/${selectedRoute.id}/entregas/${entregaId}`,
        { method: "DELETE" },
      );

      support = response.apoio;
      await refreshList({ successMessage: response.mensagem });
      await loadDetails(selectedRoute.id);
    } catch (error) {
      handlePageError(error);
    }
  }

  form.addEventListener("submit", submitRoute);
  linkForm.addEventListener("submit", handleLinkDeliveries);
  tableBody.addEventListener("click", handleTableAction);
  linkedDeliveries.addEventListener("click", handleLinkedDeliveryAction);
  for (const button of routeActions) {
    button.addEventListener("click", handleDetailAction);
  }
  refreshButton.addEventListener("click", () => refreshList().catch(handlePageError));
  newRouteButton.addEventListener("click", () => {
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

document.addEventListener("DOMContentLoaded", createRoutesApp);
