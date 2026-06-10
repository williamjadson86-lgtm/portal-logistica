const deliveryStatuses = [
  "pendente",
  "coletada",
  "em_transito",
  "em_rota",
  "entregue",
  "cancelada",
];

const eventFilters = {
  todos: [],
  entrega: ["entrega_criada", "entrega_atualizada"],
  status: ["status_alterado"],
  rotas: [
    "vinculada_rota",
    "removida_rota",
    "rota_iniciada",
    "rota_concluida",
    "rota_cancelada",
  ],
  comprovantes: ["comprovante_enviado", "comprovante_inativado"],
};

function buildDeliverySummary(data) {
  return [
    { rotulo: "Total de entregas", valor: data.totalEntregas },
    { rotulo: "Pendentes", valor: data.pendentes },
    { rotulo: "Em transito", valor: data.emTransito },
    { rotulo: "Em rota", valor: data.emRota },
    { rotulo: "Entregues", valor: data.entregues },
    { rotulo: "Canceladas", valor: data.canceladas },
  ];
}

function isProofUploadAllowed(status) {
  return ["em_rota", "entregue"].includes(status);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatProofDateTime(value) {
  if (!value) {
    return "Nao informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatEventType(type) {
  const labels = {
    entrega_criada: "Entrega criada",
    entrega_atualizada: "Entrega atualizada",
    status_alterado: "Status alterado",
    vinculada_rota: "Vinculada a rota",
    removida_rota: "Removida da rota",
    rota_iniciada: "Rota iniciada",
    rota_concluida: "Rota concluida",
    rota_cancelada: "Rota cancelada",
    comprovante_enviado: "Comprovante enviado",
    comprovante_inativado: "Comprovante inativado",
  };

  return labels[type] || String(type || "").replaceAll("_", " ");
}

function getEventCategory(type) {
  if (eventFilters.entrega.includes(type)) {
    return { key: "entrega", label: "Entrega" };
  }

  if (eventFilters.status.includes(type)) {
    return { key: "status", label: "Status" };
  }

  if (eventFilters.rotas.includes(type)) {
    return { key: "rota", label: "Rota" };
  }

  if (eventFilters.comprovantes.includes(type)) {
    return { key: "comprovante", label: "Comprovante" };
  }

  return { key: "outros", label: "Operacao" };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatEventGroupKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "sem-data";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDayGroupTitle(groupKey, now = new Date()) {
  if (!groupKey || groupKey === "sem-data") {
    return "Sem data";
  }

  const [year, month, day] = groupKey.split("-").map(Number);
  const targetDate = new Date(year, month - 1, day);
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (targetDate.getTime() === today.getTime()) {
    return "Hoje";
  }

  if (targetDate.getTime() === yesterday.getTime()) {
    return "Ontem";
  }

  return new Intl.DateTimeFormat("pt-BR").format(targetDate);
}

function groupEventsByDay(events, now = new Date()) {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  const sorted = [...events].sort((left, right) => {
    const leftTime = new Date(left.criadoEm || 0).getTime();
    const rightTime = new Date(right.criadoEm || 0).getTime();
    return rightTime - leftTime;
  });

  const groups = [];
  const map = new Map();

  for (const event of sorted) {
    const key = formatEventGroupKey(event.criadoEm);
    if (!map.has(key)) {
      const group = {
        key,
        label: formatDayGroupTitle(key, now),
        events: [],
      };
      map.set(key, group);
      groups.push(group);
    }

    map.get(key).events.push(event);
  }

  return groups;
}

function getEventVisualMeta(type) {
  const visuals = {
    entrega_criada: { icon: "\uD83D\uDCE6", className: "created" },
    entrega_atualizada: { icon: "\u270F\uFE0F", className: "updated" },
    status_alterado: { icon: "\uD83D\uDD04", className: "status" },
    vinculada_rota: { icon: "\uD83D\uDDFA\uFE0F", className: "route-linked" },
    removida_rota: { icon: "\u21A9\uFE0F", className: "route-removed" },
    rota_iniciada: { icon: "\uD83D\uDE9A", className: "route-started" },
    rota_concluida: { icon: "\u2705", className: "route-completed" },
    rota_cancelada: { icon: "\u274C", className: "route-cancelled" },
    comprovante_enviado: { icon: "\uD83D\uDCCE", className: "proof-sent" },
    comprovante_inativado: { icon: "\uD83D\uDDD1\uFE0F", className: "proof-disabled" },
  };

  return visuals[type] || { icon: "\u2022", className: "default" };
}

function filterEventsByCategory(events, filterKey = "todos") {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  if (!filterKey || filterKey === "todos") {
    return [...events];
  }

  const types = eventFilters[filterKey] || [];
  return events.filter((event) => types.includes(event.tipoEvento));
}

function getEventFilterCounts(events) {
  const source = Array.isArray(events) ? events : [];

  return {
    todos: source.length,
    entrega: filterEventsByCategory(source, "entrega").length,
    status: filterEventsByCategory(source, "status").length,
    rotas: filterEventsByCategory(source, "rotas").length,
    comprovantes: filterEventsByCategory(source, "comprovantes").length,
  };
}

function buildEventFilterChipsMarkup(events = [], activeFilter = "todos") {
  const labels = {
    todos: "Todos",
    entrega: "Entrega",
    status: "Status",
    rotas: "Rotas",
    comprovantes: "Comprovantes",
  };
  const counts = getEventFilterCounts(events);

  return Object.keys(labels)
    .map(
      (key) => `
        <button
          class="timeline-filter-chip ${key === activeFilter ? "active" : ""}"
          type="button"
          data-event-filter="${key}"
        >
          <span class="timeline-filter-chip-label">${labels[key]}</span>
          <span class="timeline-filter-chip-count">${counts[key] || 0}</span>
        </button>
      `,
    )
    .join("");
}

function buildEventTimelineMarkup(events, now = new Date(), activeFilter = "todos") {
  if (!Array.isArray(events) || events.length === 0) {
    return `
      <article class="timeline-empty">
        <strong>Nenhum evento registrado</strong>
        <p>A linha do tempo operacional desta entrega vai aparecer aqui assim que a operacao gerar movimentacoes.</p>
      </article>
    `;
  }

  const filteredEvents = filterEventsByCategory(events, activeFilter);
  if (filteredEvents.length === 0) {
    return `
      <article class="timeline-empty">
        <strong>Nenhum evento encontrado para este filtro.</strong>
        <p>Escolha outra categoria para visualizar mais itens da linha do tempo operacional.</p>
      </article>
    `;
  }

  return groupEventsByDay(filteredEvents, now)
    .map(
      (group) => `
        <section class="timeline-group">
          <header class="timeline-group-header">
            <span>${escapeHtml(group.label)}</span>
          </header>
          <div class="timeline-group-items">
            ${group.events
              .map((event) => {
                const visual = getEventVisualMeta(event.tipoEvento);
                const category = getEventCategory(event.tipoEvento);

                return `
                  <article class="timeline-item timeline-item-${visual.className}">
                    <div class="timeline-item-marker" aria-hidden="true">${visual.icon}</div>
                    <div class="timeline-item-card">
                      <div class="timeline-item-header">
                        <div>
                          <div class="timeline-item-tags">
                            <span class="timeline-item-type">${escapeHtml(formatEventType(event.tipoEvento))}</span>
                            <span class="timeline-badge timeline-badge-${category.key}">${escapeHtml(category.label)}</span>
                          </div>
                          <strong>${escapeHtml(event.descricao || "Evento operacional registrado")}</strong>
                        </div>
                        <time class="timeline-item-time">${escapeHtml(formatProofDateTime(event.criadoEm))}</time>
                      </div>
                      <div class="timeline-item-meta">
                        <span>Responsavel: ${escapeHtml(event.usuarioNome || "Sistema")}</span>
                      </div>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function buildProofHistoryMarkup(proofs) {
  if (!Array.isArray(proofs) || proofs.length === 0) {
    return `
      <article class="data-card empty">
        <strong>Nenhum comprovante vinculado</strong>
        <p>Envie um comprovante nesta entrega quando a operacao estiver em rota ou concluida.</p>
      </article>
    `;
  }

  return proofs
    .map(
      (proof) => `
        <article class="proof-card ${proof.ativo ? "" : "inactive"}">
          <div class="proof-card-top">
            <div>
              <span>Tipo</span>
              <strong>${escapeHtml(proof.tipo)}</strong>
            </div>
            <span class="status-tag">${proof.ativo ? "Ativo" : "Inativo"}</span>
          </div>
          <div class="proof-card-grid">
            <div>
              <span>Arquivo</span>
              <strong>${escapeHtml(proof.arquivoNome || "Sem arquivo")}</strong>
            </div>
            <div>
              <span>Enviado por</span>
              <strong>${escapeHtml(proof.enviadoPor || "Usuario autenticado")}</strong>
            </div>
            <div>
              <span>Envio</span>
              <strong>${escapeHtml(formatProofDateTime(proof.criadoEm))}</strong>
            </div>
            <div>
              <span>Observacao</span>
              <strong>${escapeHtml(proof.observacao || "Sem observacao")}</strong>
            </div>
          </div>
          <div class="detail-actions">
            ${
              proof.arquivoCaminho
                ? `<button class="button ghost small" type="button" data-proof-action="open" data-proof-id="${escapeHtml(proof.id)}">
                    Visualizar arquivo
                  </button>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
}

function createDeliveryApp() {
  const root = document.querySelector("[data-deliveries-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, serializeForm, createStatusLabel } = window.portalUtils;
  const message = document.querySelector("[data-delivery-message]");
  const summary = document.querySelector("[data-delivery-summary]");
  const form = document.querySelector("[data-delivery-form]");
  const formTitle = document.querySelector("[data-form-title]");
  const submitButton = document.querySelector("[data-submit-button]");
  const cancelEditButton = document.querySelector("[data-cancel-edit-button]");
  const tableBody = document.querySelector("[data-deliveries-table-body]");
  const details = document.querySelector("[data-delivery-details]");
  const eventFiltersRoot = document.querySelector("[data-delivery-event-filters]");
  const eventsTimeline = document.querySelector("[data-delivery-events]");
  const proofsHistory = document.querySelector("[data-delivery-proofs-history]");
  const proofsMessage = document.querySelector("[data-delivery-proofs-message]");
  const proofForm = document.querySelector("[data-delivery-proof-form]");
  const proofFormShell = document.querySelector("[data-delivery-proof-form-shell]");
  const proofTypeSelect = proofForm.querySelector("[name='tipo']");
  const proofFileInput = proofForm.querySelector("[name='arquivo']");
  const proofObservationInput = proofForm.querySelector("[name='observacao']");
  const proofSubmitButton = proofForm.querySelector("[data-proof-submit-button]");
  const proofHint = document.querySelector("[data-delivery-proof-hint]");
  const statusForm = document.querySelector("[data-status-form]");
  const statusQuickSelect = statusForm.querySelector("[name='status']");
  const refreshButton = document.querySelector("[data-refresh-button]");
  const newDeliveryButton = document.querySelector("[data-new-delivery-button]");

  let deliveries = [];
  let selectedDeliveryId = null;
  let selectedDelivery = null;
  let selectedEvents = [];
  let selectedProofs = [];
  let activeEventFilter = "todos";

  function handlePageError(error) {
    if (
      error.message === "Sessao invalida" ||
      error.message === "Autenticacao obrigatoria"
    ) {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function findDelivery(deliveryId) {
    return deliveries.find((delivery) => delivery.id === deliveryId) || null;
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "pendente";
    formTitle.textContent = "Nova entrega";
    submitButton.textContent = "Salvar entrega";
    cancelEditButton.hidden = true;
  }

  function resetProofForm() {
    proofForm.reset();
    proofTypeSelect.value = "foto";
    proofObservationInput.value = "";
  }

  function fillForm(delivery) {
    form.elements.id.value = delivery.id;
    form.elements.codigo.value = delivery.codigo;
    form.elements.cliente.value = delivery.cliente;
    form.elements.origem.value = delivery.origem;
    form.elements.destino.value = delivery.destino;
    form.elements.cidade.value = delivery.cidade;
    form.elements.estado.value = delivery.estado;
    form.elements.status.value = delivery.status;
    form.elements.dataPrevista.value = delivery.dataPrevista || "";
    form.elements.observacoes.value = delivery.observacoes || "";
    formTitle.textContent = `Editar ${delivery.codigo}`;
    submitButton.textContent = "Salvar alteracoes";
    cancelEditButton.hidden = false;
  }

  function renderSummaryCards(resumo) {
    summary.innerHTML = buildDeliverySummary(resumo)
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

  function renderProofUploadState(delivery) {
    const allowed = isProofUploadAllowed(delivery?.status);

    proofFormShell.hidden = !delivery;
    proofForm.hidden = !delivery || !allowed;
    proofSubmitButton.disabled = !delivery || !allowed;
    proofTypeSelect.disabled = !delivery || !allowed;
    proofFileInput.disabled = !delivery || !allowed;
    proofObservationInput.disabled = !delivery || !allowed;

    if (!delivery) {
      proofHint.textContent = "Selecione uma entrega para habilitar o envio de comprovantes.";
      return;
    }

    if (allowed) {
      proofHint.textContent =
        "Envie fotos, PDFs, assinatura ou observacao operacional desta entrega.";
      return;
    }

    proofHint.textContent =
      "O envio de comprovantes fica disponivel apenas para entregas em rota ou entregues.";
  }

  function renderDeliveryDetails(delivery) {
    if (!delivery) {
      details.className = "delivery-details empty";
      details.textContent =
        "Selecione uma entrega para visualizar os detalhes operacionais.";
      statusQuickSelect.value = "pendente";
      eventFiltersRoot.innerHTML = buildEventFilterChipsMarkup([], "todos");
      eventsTimeline.innerHTML = buildEventTimelineMarkup([], new Date(), "todos");
      proofsHistory.innerHTML = buildProofHistoryMarkup([]);
      setMessage(proofsMessage, "", "");
      renderProofUploadState(null);
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div>
          <span>Codigo</span>
          <strong>${delivery.codigo}</strong>
        </div>
        <div>
          <span>Cliente</span>
          <strong>${delivery.cliente}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>${createStatusLabel(delivery.status)}</strong>
        </div>
        <div>
          <span>Data prevista</span>
          <strong>${delivery.dataPrevista || "Nao informada"}</strong>
        </div>
        <div>
          <span>Cidade / UF</span>
          <strong>${delivery.cidade} / ${delivery.estado}</strong>
        </div>
        <div>
          <span>Origem</span>
          <strong>${delivery.origem}</strong>
        </div>
        <div>
          <span>Destino</span>
          <strong>${delivery.destino}</strong>
        </div>
        <div>
          <span>Observacoes</span>
          <strong>${delivery.observacoes || "Sem observacoes"}</strong>
        </div>
        <div>
          <span>Rota vinculada</span>
          <strong>${delivery.rotaAtual ? `${delivery.rotaAtual.codigo} (${createStatusLabel(delivery.rotaAtual.status)})` : "Sem rota ativa"}</strong>
        </div>
        <div>
          <span>Motorista vinculado</span>
          <strong>${delivery.motorista ? delivery.motorista.nome : "Nao vinculado"}</strong>
        </div>
        <div>
          <span>Veiculo vinculado</span>
          <strong>${delivery.veiculo ? `${delivery.veiculo.placa}${delivery.veiculo.modelo ? ` - ${delivery.veiculo.modelo}` : ""}` : "Nao vinculado"}</strong>
        </div>
      </div>
    `;
    statusQuickSelect.value = delivery.status;
    renderProofUploadState(delivery);
  }

  function renderProofHistory(proofs) {
    selectedProofs = proofs;
    proofsHistory.innerHTML = buildProofHistoryMarkup(proofs);
  }

  function renderEventTimeline(events) {
    selectedEvents = events;
    eventFiltersRoot.innerHTML = buildEventFilterChipsMarkup(events, activeEventFilter);
    eventsTimeline.innerHTML = buildEventTimelineMarkup(events, new Date(), activeEventFilter);
  }

  function renderTable() {
    if (deliveries.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8">Nenhuma entrega cadastrada para este usuario.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = deliveries
      .map(
        (delivery) => `
          <tr>
            <td>${delivery.codigo}</td>
            <td>${delivery.cliente}</td>
            <td>${delivery.origem}</td>
            <td>${delivery.destino}</td>
            <td>${delivery.cidade}/${delivery.estado}</td>
            <td><span class="status-tag">${createStatusLabel(delivery.status)}</span></td>
            <td>${delivery.dataPrevista || "-"}</td>
            <td>
              <div class="row-actions">
                <button class="button ghost small" type="button" data-action="view" data-id="${delivery.id}">
                  Visualizar
                </button>
                <button class="button ghost small" type="button" data-action="edit" data-id="${delivery.id}">
                  Editar
                </button>
                <button class="button ghost small" type="button" data-action="status" data-id="${delivery.id}">
                  Atualizar status
                </button>
                <button class="button ghost small danger" type="button" data-action="delete" data-id="${delivery.id}">
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function loadDetails(deliveryId) {
    const [deliveryResponse, eventsResponse, proofsResponse] = await Promise.all([
      requestJson(`/api/entregas/${deliveryId}`),
      requestJson(`/api/entregas/${deliveryId}/eventos`),
      requestJson(`/api/entregas/${deliveryId}/comprovantes`),
    ]);

    selectedDeliveryId = deliveryResponse.entrega.id;
    selectedDelivery = deliveryResponse.entrega;
    activeEventFilter = "todos";
    setMessage(proofsMessage, "", "");
    renderDeliveryDetails(selectedDelivery);
    renderEventTimeline(eventsResponse.eventos || []);
    renderProofHistory(proofsResponse.comprovantes || []);
    return selectedDelivery;
  }

  async function refreshList(options = {}) {
    const { preserveSelection = true, successMessage = "" } = options;

    const response = await requestJson("/api/entregas");
    deliveries = response.entregas;
    renderSummaryCards(response.resumo);
    renderTable();

    if (selectedDeliveryId && preserveSelection) {
      const selected = findDelivery(selectedDeliveryId);
      if (selected) {
        await loadDetails(selected.id);
      } else {
        selectedDeliveryId = null;
        selectedDelivery = null;
        renderDeliveryDetails(null);
      }
    } else {
      selectedDeliveryId = null;
      selectedDelivery = null;
      renderDeliveryDetails(null);
    }

    if (successMessage) {
      setMessage(message, "success", successMessage);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = serializeForm(form);
    const deliveryId = payload.id;

    delete payload.id;
    payload.estado = payload.estado.toUpperCase();

    try {
      if (deliveryId) {
        const response = await requestJson(`/api/entregas/${deliveryId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        selectedDeliveryId = response.entrega.id;
        resetForm();
        await refreshList({
          successMessage: response.mensagem,
        });
        await loadDetails(response.entrega.id);
      } else {
        const response = await requestJson("/api/entregas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        selectedDeliveryId = response.entrega.id;
        resetForm();
        await refreshList({
          successMessage: response.mensagem,
        });
        await loadDetails(response.entrega.id);
      }
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleProofSubmit(event) {
    event.preventDefault();

    if (!selectedDeliveryId || !selectedDelivery) {
      setMessage(proofsMessage, "error", "Selecione uma entrega antes de enviar comprovantes.");
      return;
    }

    if (!isProofUploadAllowed(selectedDelivery.status)) {
      setMessage(
        proofsMessage,
        "error",
        "O envio de comprovantes esta disponivel apenas para entregas em rota ou entregues.",
      );
      return;
    }

    const formData = new FormData();
    formData.set("tipo", proofTypeSelect.value);
    formData.set("observacao", proofObservationInput.value.trim());

    if (proofFileInput.files[0]) {
      formData.set("arquivo", proofFileInput.files[0]);
    }

    try {
      const response = await requestJson(`/api/entregas/${selectedDeliveryId}/comprovantes`, {
        method: "POST",
        body: formData,
      });

      resetProofForm();
      setMessage(proofsMessage, "success", response.mensagem);
      await loadDetails(selectedDeliveryId);
    } catch (error) {
      handlePageError(error);
      setMessage(proofsMessage, "error", error.message);
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();

    if (!selectedDeliveryId) {
      setMessage(message, "error", "Selecione uma entrega antes de atualizar o status.");
      return;
    }

    try {
      const response = await requestJson(`/api/entregas/${selectedDeliveryId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusQuickSelect.value }),
      });
      await refreshList({
        successMessage: response.mensagem,
      });
      await loadDetails(selectedDeliveryId);
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
        setMessage(message, "", "");
        return;
      }

      if (action === "edit") {
        const delivery = await loadDetails(id);
        fillForm(delivery);
        setMessage(message, "", "");
        return;
      }

      if (action === "status") {
        await loadDetails(id);
        statusForm.scrollIntoView({ behavior: "smooth", block: "center" });
        setMessage(message, "", "");
        return;
      }

      if (action === "delete") {
        const delivery = findDelivery(id) || (await loadDetails(id));
        const confirmed = window.confirm(
          `Deseja realmente excluir a entrega ${delivery.codigo}?`,
        );

        if (!confirmed) {
          return;
        }

        const response = await requestJson(`/api/entregas/${id}`, {
          method: "DELETE",
        });

        if (selectedDeliveryId === id) {
          selectedDeliveryId = null;
          selectedDelivery = null;
          renderDeliveryDetails(null);
        }

        resetForm();
        await refreshList({
          preserveSelection: false,
          successMessage: response.mensagem,
        });
      }
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleProofAction(event) {
    const button = event.target.closest("[data-proof-action]");
    if (!button) {
      return;
    }

    const { proofAction, proofId } = button.dataset;
    if (proofAction !== "open") {
      return;
    }

    const proof = selectedProofs.find((item) => item.id === proofId);
    if (!proof || !proof.arquivoCaminho) {
      setMessage(proofsMessage, "error", "Arquivo de comprovante indisponivel.");
      return;
    }

    window.open(`/api/comprovantes/${proof.id}/arquivo`, "_blank", "noopener");
  }

  function handleEventFilterClick(event) {
    const button = event.target.closest("[data-event-filter]");
    if (!button) {
      return;
    }

    activeEventFilter = button.dataset.eventFilter || "todos";
    renderEventTimeline(selectedEvents);
  }

  form.addEventListener("submit", handleSubmit);
  proofForm.addEventListener("submit", handleProofSubmit);
  statusForm.addEventListener("submit", handleStatusSubmit);
  tableBody.addEventListener("click", handleRowAction);
  eventFiltersRoot.addEventListener("click", handleEventFilterClick);
  proofsHistory.addEventListener("click", handleProofAction);
  refreshButton.addEventListener("click", () =>
    refreshList().catch((error) => {
      handlePageError(error);
    }),
  );
  newDeliveryButton.addEventListener("click", () => {
    resetForm();
    setMessage(message, "", "");
  });
  cancelEditButton.addEventListener("click", () => {
    resetForm();
    setMessage(message, "", "");
  });

  resetForm();
  resetProofForm();
  renderDeliveryDetails(null);
  refreshList().catch((error) => {
    handlePageError(error);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", createDeliveryApp);
}

if (typeof module !== "undefined") {
  module.exports = {
    buildEventFilterChipsMarkup,
    buildEventTimelineMarkup,
    buildProofHistoryMarkup,
    filterEventsByCategory,
    getEventFilterCounts,
    formatProofDateTime,
    formatDayGroupTitle,
    formatEventType,
    getEventCategory,
    getEventVisualMeta,
    groupEventsByDay,
    isProofUploadAllowed,
  };
}
