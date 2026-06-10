async function requestJson(url, options = {}) {
  const hasFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = hasFormDataBody
    ? { ...(options.headers || {}) }
    : {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };

  const response = await fetch(url, {
    credentials: "same-origin",
    headers,
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const details = body?.detalhes?.join(", ");
    const message = details || body?.erro || "Nao foi possivel concluir a solicitacao.";
    throw new Error(message);
  }

  return body;
}

function setMessage(element, type, text) {
  if (!element) {
    return;
  }

  element.className = `message ${type}`.trim();
  element.textContent = text;
}

function serializeForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function createStatusLabel(value) {
  if (!value) {
    return "";
  }

  return String(value).replaceAll("_", " ");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-login-message]");
  const payload = serializeForm(form);

  if (!payload.matricula || !payload.senha) {
    setMessage(message, "error", "Preencha matricula e senha.");
    return;
  }

  try {
    setMessage(message, "", "");
    await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    window.location.href = "/home";
  } catch (error) {
    setMessage(message, "error", error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-register-message]");
  const payload = serializeForm(form);

  if (payload.senha !== payload.confirmacaoSenha) {
    setMessage(message, "error", "As senhas informadas nao conferem.");
    return;
  }

  try {
    setMessage(message, "", "");
    await requestJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMessage(message, "success", "Cadastro concluido. Redirecionando para a home...");
    setTimeout(() => {
      window.location.href = "/home";
    }, 900);
  } catch (error) {
    setMessage(message, "error", error.message);
  }
}

function renderDashboardMetrics(data) {
  const grid = document.querySelector("[data-dashboard-grid]");
  if (!grid) {
    return;
  }

  const stats = [
    { rotulo: "Total de entregas", valor: data.metricas.totalEntregas },
    { rotulo: "Entregas pendentes", valor: data.metricas.entregasPendentes },
    { rotulo: "Entregas em transito", valor: data.metricas.entregasEmTransito },
    { rotulo: "Entregas em rota", valor: data.metricas.entregasEmRota },
    { rotulo: "Entregas entregues", valor: data.metricas.entregasEntregues },
    { rotulo: "Rotas planejadas", valor: data.metricas.rotasPlanejadas },
    { rotulo: "Rotas em andamento", valor: data.metricas.rotasEmAndamento },
    { rotulo: "Rotas concluidas", valor: data.metricas.rotasConcluidas },
    { rotulo: "Motoristas ativos", valor: data.metricas.motoristasAtivos },
    { rotulo: "Veiculos disponiveis", valor: data.metricas.veiculosDisponiveis },
    { rotulo: "Veiculos em rota", valor: data.metricas.veiculosEmRota },
    { rotulo: "Veiculos em manutencao", valor: data.metricas.veiculosEmManutencao },
    { rotulo: "Receita do periodo", valor: formatCurrency(data.metricas.receitaTotalPeriodo) },
    { rotulo: "Valores pendentes", valor: formatCurrency(data.metricas.valoresPendentes) },
    { rotulo: "Valores pagos", valor: formatCurrency(data.metricas.valoresPagos) },
    { rotulo: "Lancamentos vencidos", valor: data.metricas.lancamentosVencidos },
  ];

  grid.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <span>${stat.rotulo}</span>
          <strong>${stat.valor}</strong>
        </article>
      `,
    )
    .join("");
}

function renderDashboardAlerts(data) {
  const container = document.querySelector("[data-dashboard-alerts]");
  if (!container) {
    return;
  }

  const alerts = [
    {
      titulo: "Entregas pendentes vencidas",
      valor: data.alertas.entregasPendentesVencidas,
      descricao: "Pendencias com previsao anterior a hoje.",
    },
    {
      titulo: "Rotas planejadas para hoje",
      valor: data.alertas.rotasPlanejadasHoje,
      descricao: "Programacoes que deveriam entrar em execucao hoje.",
    },
    {
      titulo: "Veiculos em manutencao",
      valor: data.alertas.veiculosEmManutencao,
      descricao: "Frota indisponivel por manutencao.",
    },
    {
      titulo: "Motoristas inativos",
      valor: data.alertas.motoristasInativos,
      descricao: "Condutores fora da operacao atual.",
    },
    {
      titulo: "Entregas entregues sem comprovante",
      valor: data.alertas.entregasEntreguesSemComprovante,
      descricao: "Entregas finalizadas ainda sem comprovacao registrada.",
    },
    {
      titulo: "Entregas sem rota",
      valor: data.alertas.entregasSemRota,
      descricao: "Entregas elegiveis ainda nao alocadas.",
    },
    {
      titulo: "Rotas em andamento",
      valor: data.alertas.rotasEmAndamento,
      descricao: "Rotas ativas exigindo acompanhamento.",
    },
    {
      titulo: "Lancamentos vencidos",
      valor: data.alertas.lancamentosVencidos,
      descricao: "Titulos pendentes ou faturados ja vencidos.",
    },
  ];

  container.innerHTML = alerts
    .map(
      (alert) => `
        <article class="data-card">
          <div class="data-card-top">
            <div>
              <h3>${alert.titulo}</h3>
              <p>${alert.descricao}</p>
            </div>
            <span class="status-tag">${alert.valor}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderDashboardProductivity(data) {
  const container = document.querySelector("[data-dashboard-productivity]");
  if (!container) {
    return;
  }

  const items = [
    {
      titulo: "Entregas concluidas no periodo",
      valor: data.produtividade.entregasConcluidasPeriodo,
      descricao: "Total de entregas concluido dentro da janela filtrada.",
    },
    {
      titulo: "Percentual de conclusao",
      valor: `${data.produtividade.percentualConclusao}%`,
      descricao: "Proporcao de entregas concluidas em relacao ao total do periodo.",
    },
    {
      titulo: "Media de entregas por rota",
      valor: data.produtividade.mediaEntregasPorRota,
      descricao: "Media de carga operacional alocada por rota no periodo.",
    },
    {
      titulo: "Rotas concluidas",
      valor: data.produtividade.rotasConcluidasPeriodo,
      descricao: "Rotas encerradas no intervalo selecionado.",
    },
    {
      titulo: "Entregas ainda sem rota",
      valor: data.produtividade.entregasSemRota,
      descricao: "Pendencias operacionais que ainda aguardam alocacao.",
    },
    {
      titulo: "Total de comprovantes no periodo",
      valor: data.produtividade.totalComprovantesPeriodo,
      descricao: "Volume de comprovantes ativos enviados no intervalo.",
    },
    {
      titulo: "Entregas entregues sem comprovante",
      valor: data.produtividade.entregasEntreguesSemComprovante,
      descricao: "Ponto de atencao para encerramento operacional.",
    },
    {
      titulo: "Receita total do periodo",
      valor: formatCurrency(data.produtividade.receitaTotalPeriodo),
      descricao: "Receita operacional consolidada na janela filtrada.",
    },
    {
      titulo: "Valores pendentes",
      valor: formatCurrency(data.produtividade.valoresPendentes),
      descricao: "Volume financeiro aguardando faturamento ou pagamento.",
    },
    {
      titulo: "Valores pagos",
      valor: formatCurrency(data.produtividade.valoresPagos),
      descricao: "Recebimentos ja liquidados no periodo.",
    },
    {
      titulo: "Lancamentos vencidos",
      valor: data.produtividade.lancamentosVencidos,
      descricao: "Pendencias financeiras fora do prazo de vencimento.",
    },
  ];

  container.innerHTML = items
    .map(
      (item) => `
        <article class="data-card">
          <h3>${item.titulo}</h3>
          <strong>${item.valor}</strong>
          <p>${item.descricao}</p>
        </article>
      `,
    )
    .join("");
}

function formatPeriodLabel(filter) {
  const labels = {
    hoje: "Hoje",
    "7d": "Ultimos 7 dias",
    "30d": "Ultimos 30 dias",
    custom: `Periodo personalizado: ${filter.dataInicio} ate ${filter.dataFim}`,
  };

  return labels[filter.periodo] || "Ultimos 7 dias";
}

function renderCards(cards) {
  const grid = document.querySelector("[data-cards-grid]");
  if (!grid) {
    return;
  }

  grid.innerHTML = cards
    .map((card) => {
      const href = card.href || "#";

      return `
        <a class="menu-card" href="${href}">
          <div class="icon">${card.icone}</div>
          <div>
            <h3>${card.titulo}</h3>
            <p>${card.descricao}</p>
          </div>
        </a>
      `;
    })
    .join("");
}

function buildDashboardUrl(filters) {
  const query = new URLSearchParams();
  query.set("periodo", filters.periodo || "7d");

  if (filters.periodo === "custom") {
    query.set("dataInicio", filters.dataInicio || "");
    query.set("dataFim", filters.dataFim || "");
  }

  return `/api/dashboard?${query.toString()}`;
}

async function loadHome() {
  const welcome = document.querySelector("[data-user-name]");
  const role = document.querySelector("[data-user-role]");
  const matricula = document.querySelector("[data-user-matricula]");
  const filterForm = document.querySelector("[data-dashboard-filter-form]");
  const periodSelect = document.querySelector("[data-dashboard-period]");
  const customRange = document.querySelector("[data-dashboard-custom-range]");
  const periodLabel = document.querySelector("[data-dashboard-period-label]");
  const message = document.querySelector("[data-dashboard-message]");
  const loading = document.querySelector("[data-dashboard-loading]");

  if (!welcome || !filterForm) {
    return;
  }

  function toggleCustomRange() {
    customRange.hidden = periodSelect.value !== "custom";
  }

  async function fetchHomeData(filters = { periodo: periodSelect.value || "7d" }) {
    try {
      loading.hidden = false;
      setMessage(message, "", "");

      const [portalData, dashboardData] = await Promise.all([
        requestJson("/api/portal/home"),
        requestJson(buildDashboardUrl(filters)),
      ]);

      welcome.textContent = portalData.usuario.nome.split(" ")[0];
      role.textContent = portalData.usuario.tipoUsuario;
      matricula.textContent = portalData.usuario.matricula;
      renderCards(portalData.cards);
      renderDashboardMetrics(dashboardData);
      renderDashboardAlerts(dashboardData);
      renderDashboardProductivity(dashboardData);
      periodLabel.textContent = formatPeriodLabel(dashboardData.filtro);
    } catch (error) {
      if (
        error.message === "Sessao invalida" ||
        error.message === "Autenticacao obrigatoria"
      ) {
        window.location.href = "/login";
        return;
      }

      setMessage(message, "error", error.message);
    } finally {
      loading.hidden = true;
    }
  }

  periodSelect.addEventListener("change", toggleCustomRange);
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const filters = serializeForm(filterForm);
    fetchHomeData(filters);
  });

  toggleCustomRange();
  fetchHomeData();
}

function renderSummary(summary) {
  const container = document.querySelector("[data-module-summary]");
  if (!container) {
    return;
  }

  container.innerHTML = (summary || [])
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

function renderHighlights(highlights) {
  const container = document.querySelector("[data-module-highlights]");
  if (!container) {
    return;
  }

  container.innerHTML = (highlights || [])
    .map(
      (item) => `
        <div class="highlight-item">
          <span>${item.rotulo}</span>
          <strong>${item.valor}</strong>
        </div>
      `,
    )
    .join("");
}

function renderItems(items) {
  const container = document.querySelector("[data-module-items]");
  if (!container) {
    return;
  }

  if (!items || items.length === 0) {
    container.innerHTML = `
      <article class="data-card empty">
        <h3>Nenhum registro encontrado</h3>
        <p>Este modulo ainda nao possui dados vinculados ao usuario autenticado.</p>
      </article>
    `;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="data-card">
          <div class="data-card-top">
            <div>
              <h3>${item.titulo}</h3>
              <p>${item.subtitulo || ""}</p>
            </div>
            <span class="status-tag">${createStatusLabel(item.status)}</span>
          </div>
          <strong>${item.meta || ""}</strong>
          <p>${item.descricao || ""}</p>
        </article>
      `,
    )
    .join("");
}

async function loadModulePage() {
  const modulePage = document.querySelector("[data-module-page]");
  if (!modulePage) {
    return;
  }

  try {
    const data = await requestJson(modulePage.dataset.apiEndpoint);
    const title = document.querySelector("[data-module-title]");
    const description = document.querySelector("[data-module-description]");

    if (title) {
      title.textContent = data.modulo.titulo;
    }

    if (description) {
      description.textContent = data.modulo.descricao;
    }

    renderSummary(data.resumo);
    renderHighlights(data.destaques);
    renderItems(data.itens);
  } catch (_error) {
    window.location.href = "/login";
  }
}

async function logout() {
  await requestJson("/api/auth/logout", {
    method: "POST",
  });
  window.location.href = "/login";
}

window.portalUtils = {
  requestJson,
  setMessage,
  serializeForm,
  createStatusLabel,
  formatCurrency,
  logout,
};

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const registerForm = document.querySelector("[data-register-form]");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  const logoutButton = document.querySelector("[data-logout-button]");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  loadHome();
  loadModulePage();
});
