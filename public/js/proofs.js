function createProofsApp() {
  const root = document.querySelector("[data-proofs-app]");
  if (!root) {
    return;
  }

  const { requestJson, setMessage, createStatusLabel } = window.portalUtils;
  const message = document.querySelector("[data-proof-message]");
  const summary = document.querySelector("[data-proof-summary]");
  const form = document.querySelector("[data-proof-form]");
  const filterForm = document.querySelector("[data-proof-filter-form]");
  const uploadDeliverySelect = document.querySelector("[data-proof-form] [name='entregaId']");
  const filterDeliverySelect = document.querySelector("[data-proof-filter-form] [name='entregaId']");
  const typeSelect = document.querySelector("[data-proof-form] [name='tipo']");
  const fileInput = document.querySelector("[data-proof-form] [name='arquivo']");
  const details = document.querySelector("[data-proof-details]");
  const list = document.querySelector("[data-proofs-list]");
  const refreshButton = document.querySelector("[data-refresh-button]");

  let proofs = [];
  let deliveries = [];

  function handlePageError(error) {
    if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
      window.location.href = "/login";
      return;
    }

    setMessage(message, "error", error.message);
  }

  function buildDeliveryLabel(delivery) {
    return `${delivery.codigo} | ${delivery.cliente} | ${createStatusLabel(delivery.status)}`;
  }

  function renderSummaryCards(data) {
    const cards = [
      { rotulo: "Total de comprovantes", valor: data.total },
      { rotulo: "Fotos", valor: data.fotos },
      { rotulo: "PDFs", valor: data.pdfs },
      { rotulo: "Observacoes", valor: data.observacoes },
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

  function populateDeliveryOptions() {
    const options = deliveries
      .map(
        (delivery) =>
          `<option value="${delivery.id}">${buildDeliveryLabel(delivery)}</option>`,
      )
      .join("");

    uploadDeliverySelect.innerHTML = options;
    filterDeliverySelect.innerHTML = `<option value="">Todas as entregas</option>${options}`;
  }

  function toggleFileInput() {
    const isObservation = typeSelect.value === "observacao";
    fileInput.disabled = isObservation;
    fileInput.required = !isObservation;
  }

  function renderDetails(proof) {
    if (!proof) {
      details.className = "delivery-details empty";
      details.textContent = "Selecione um comprovante para visualizar os detalhes do registro.";
      return;
    }

    details.className = "delivery-details";
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>Entrega</span><strong>${proof.codigoEntrega}</strong></div>
        <div><span>Tipo</span><strong>${createStatusLabel(proof.tipo)}</strong></div>
        <div><span>Arquivo</span><strong>${proof.arquivoNome || "Sem arquivo"}</strong></div>
        <div><span>MIME type</span><strong>${proof.mimeType || "Nao se aplica"}</strong></div>
        <div><span>Tamanho</span><strong>${proof.tamanhoBytes || 0} bytes</strong></div>
        <div><span>Observacao</span><strong>${proof.observacao || "Sem observacao"}</strong></div>
        <div><span>Registrado em</span><strong>${new Date(proof.criadoEm).toLocaleString("pt-BR")}</strong></div>
      </div>
    `;
  }

  function renderList() {
    if (proofs.length === 0) {
      list.innerHTML = `
        <article class="data-card empty">
          <h3>Nenhum comprovante encontrado</h3>
          <p>Ajuste o filtro ou envie um novo comprovante para a entrega desejada.</p>
        </article>
      `;
      return;
    }

    list.innerHTML = proofs
      .map(
        (proof) => `
          <article class="data-card">
            <div class="data-card-top">
              <div>
                <h3>${proof.arquivoNome || `Registro ${createStatusLabel(proof.tipo)}`}</h3>
                <p>Entrega ${proof.codigoEntrega} | ${proof.cliente || ""}</p>
              </div>
              <span class="status-tag">${createStatusLabel(proof.tipo)}</span>
            </div>
            <strong>${new Date(proof.criadoEm).toLocaleString("pt-BR")}</strong>
            <p>${proof.observacao || "Sem observacao adicional."}</p>
            <div class="row-actions">
              <button class="button ghost small" type="button" data-action="view" data-id="${proof.id}">
                Visualizar
              </button>
              ${
                proof.arquivoCaminho
                  ? `<a class="button ghost small" href="/api/comprovantes/${proof.id}/arquivo" target="_blank" rel="noreferrer">Abrir arquivo</a>`
                  : ""
              }
              <button class="button ghost small danger" type="button" data-action="deactivate" data-id="${proof.id}">
                Inativar
              </button>
            </div>
          </article>
        `,
      )
      .join("");
  }

  async function loadProofDetails(proofId) {
    const response = await requestJson(`/api/comprovantes/${proofId}`);
    renderDetails(response.comprovante);
  }

  async function refreshProofs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.entregaId) {
      params.set("entregaId", filters.entregaId);
    }

    const response = await requestJson(
      `/api/comprovantes${params.toString() ? `?${params.toString()}` : ""}`,
    );

    proofs = response.comprovantes;
    deliveries = response.entregas;
    renderSummaryCards(response.resumo);
    populateDeliveryOptions();
    toggleFileInput();
    renderList();
    renderDetails(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const entregaId = formData.get("entregaId");

    try {
      const response = await requestJson(`/api/entregas/${entregaId}/comprovantes`, {
        method: "POST",
        body: formData,
      });

      form.reset();
      toggleFileInput();
      await refreshProofs({ entregaId: filterDeliverySelect.value });
      await loadProofDetails(response.comprovante.id);
      setMessage(message, "success", response.mensagem);
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleFilter(event) {
    event.preventDefault();

    try {
      await refreshProofs({ entregaId: filterDeliverySelect.value });
      setMessage(message, "", "");
    } catch (error) {
      handlePageError(error);
    }
  }

  async function handleListAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const proofId = button.dataset.id;

    try {
      if (button.dataset.action === "view") {
        await loadProofDetails(proofId);
        setMessage(message, "", "");
        return;
      }

      if (!window.confirm("Deseja inativar este comprovante?")) {
        return;
      }

      const response = await requestJson(`/api/comprovantes/${proofId}`, {
        method: "DELETE",
      });
      await refreshProofs({ entregaId: filterDeliverySelect.value });
      setMessage(message, "success", response.mensagem);
    } catch (error) {
      handlePageError(error);
    }
  }

  form.addEventListener("submit", handleSubmit);
  filterForm.addEventListener("submit", handleFilter);
  typeSelect.addEventListener("change", toggleFileInput);
  list.addEventListener("click", handleListAction);
  refreshButton.addEventListener("click", () => {
    refreshProofs({ entregaId: filterDeliverySelect.value }).catch(handlePageError);
  });

  refreshProofs().catch(handlePageError);
}

document.addEventListener("DOMContentLoaded", createProofsApp);
