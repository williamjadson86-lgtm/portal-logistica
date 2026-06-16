function createSettingsPage() {
  const utils = window.portalUtils;
  if (!utils) {
    return;
  }

  const {
    requestJson,
    setMessage,
    serializeForm,
    createStatusLabel,
  } = utils;

  const loading = document.querySelector("[data-settings-loading]");
  const message = document.querySelector("[data-settings-message]");
  const summary = document.querySelector("[data-settings-summary]");
  const companyForm = document.querySelector("[data-company-form]");
  const platformSettingsForm = document.querySelector("[data-platform-settings-form]");
  const userForm = document.querySelector("[data-user-form]");
  const usersTableBody = document.querySelector("[data-users-table-body]");
  const permissionsList = document.querySelector("[data-permissions-list]");
  const permissionsCatalog = document.querySelector("[data-permissions-catalog]");
  const resetUserFormButton = document.querySelector("[data-user-form-reset]");

  let currentUsers = [];

  function renderSummary(data) {
    const cards = [
      { rotulo: "Usuarios totais", valor: data.resumoUsuarios.total },
      { rotulo: "Usuarios ativos", valor: data.resumoUsuarios.ativos },
      { rotulo: "Usuarios bloqueados", valor: data.resumoUsuarios.bloqueados },
      { rotulo: "Empresa ativa", valor: data.empresa?.status === "ativo" ? "Sim" : "Nao" },
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

  function fillCompanyForm(company) {
    if (!company) {
      return;
    }

    companyForm.elements.id.value = company.id || "";
    companyForm.elements.razaoSocial.value = company.razaoSocial || "";
    companyForm.elements.nomeFantasia.value = company.nomeFantasia || "";
    companyForm.elements.cnpj.value = company.cnpj || "";
    companyForm.elements.email.value = company.email || "";
    companyForm.elements.telefone.value = company.telefone || "";
    companyForm.elements.endereco.value = company.endereco || "";
    companyForm.elements.cidade.value = company.cidade || "";
    companyForm.elements.estado.value = company.estado || "";
    companyForm.elements.cep.value = company.cep || "";
    companyForm.elements.logoUrl.value = company.logoUrl || "";
    companyForm.elements.status.value = company.status || "ativo";
  }

  function fillSettingsForm(settings) {
    platformSettingsForm.elements.timezone.value = settings.timezone || "America/Sao_Paulo";
    platformSettingsForm.elements.moeda.value = settings.moeda || "BRL";
    platformSettingsForm.elements.formatoData.value = settings.formatoData || "DD/MM/YYYY";
    platformSettingsForm.elements.dashboardPeriodoPadrao.value =
      settings.dashboardPeriodoPadrao || "7d";
    platformSettingsForm.elements.dashboardExibirFinanceiro.value =
      String(settings.dashboardExibirFinanceiro !== false);
  }

  function resetUserForm() {
    userForm.reset();
    userForm.elements.id.value = "";
    userForm.elements.perfil.value = "operador";
    userForm.elements.status.value = "ativo";
  }

  function startEditUser(user) {
    userForm.elements.id.value = user.id;
    userForm.elements.nome.value = user.nome || "";
    userForm.elements.email.value = user.email || "";
    userForm.elements.documento.value = user.documento || "";
    userForm.elements.telefone.value = user.telefone || "";
    userForm.elements.matricula.value = user.matricula || "";
    userForm.elements.perfil.value = user.perfil || "operador";
    userForm.elements.status.value = user.status || "ativo";
    userForm.elements.senha.value = "";
    userForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindUserActions() {
    usersTableBody.querySelectorAll("[data-action='edit']").forEach((button) => {
      button.addEventListener("click", () => {
        const user = currentUsers.find((item) => item.id === button.dataset.id);
        if (user) {
          startEditUser(user);
        }
      });
    });

    usersTableBody.querySelectorAll("[data-action='toggle-status']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const nextStatus = button.dataset.status;
          await requestJson(`/api/usuarios/${button.dataset.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: nextStatus }),
          });
          await loadPage();
          setMessage(message, "success", "Status do usuario atualizado.");
        } catch (error) {
          setMessage(message, "error", error.message);
        }
      });
    });

    usersTableBody.querySelectorAll("[data-action='reset-password']").forEach((button) => {
      button.addEventListener("click", async () => {
        const novaSenha = window.prompt("Informe a nova senha do usuario:");
        if (!novaSenha) {
          return;
        }

        try {
          await requestJson(`/api/usuarios/${button.dataset.id}/reset-password`, {
            method: "PATCH",
            body: JSON.stringify({ novaSenha }),
          });
          setMessage(message, "success", "Senha redefinida com sucesso.");
        } catch (error) {
          setMessage(message, "error", error.message);
        }
      });
    });
  }

  function renderUsers(users) {
    currentUsers = users;
    if (!users.length) {
      usersTableBody.innerHTML = '<tr><td colspan="6">Nenhum usuario encontrado.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = users
      .map(
        (user) => `
          <tr>
            <td>${user.nome}</td>
            <td>${user.email}</td>
            <td>${createStatusLabel(user.perfil)}</td>
            <td><span class="status-tag">${createStatusLabel(user.status)}</span></td>
            <td>${user.matricula}</td>
            <td>
              <button class="button ghost small" type="button" data-action="edit" data-id="${user.id}">Editar</button>
              <button
                class="button ghost small"
                type="button"
                data-action="toggle-status"
                data-id="${user.id}"
                data-status="${user.ativo ? "bloqueado" : "ativo"}"
              >
                ${user.ativo ? "Bloquear" : "Reativar"}
              </button>
              <button class="button ghost small" type="button" data-action="reset-password" data-id="${user.id}">
                Resetar senha
              </button>
            </td>
          </tr>
        `,
      )
      .join("");

    bindUserActions();
  }

  function renderPermissions(data) {
    permissionsList.innerHTML = data.perfis
      .map(
        (perfil) => `
          <article class="data-card">
            <h3>${createStatusLabel(perfil.perfil)}</h3>
            <strong>${perfil.modulosLiberados.length} modulo(s)</strong>
            <p>${perfil.modulosLiberados.join(", ") || "Sem modulos liberados."}</p>
          </article>
        `,
      )
      .join("");

    permissionsCatalog.innerHTML = `
      <article class="data-card">
        <h3>Permissoes disponiveis</h3>
        ${data.permissoes.map((permission) => `<p>${permission}</p>`).join("")}
      </article>
    `;
  }

  async function loadPage() {
    try {
      loading.hidden = false;
      setMessage(message, "", "");
      const data = await requestJson("/api/configuracoes");
      renderSummary(data);
      fillCompanyForm(data.empresa);
      fillSettingsForm(data.configuracoes);
      renderUsers(data.usuarios || []);
      renderPermissions(data.permissoes);
    } catch (error) {
      if (error.statusCode === 403) {
        window.location.href = "/acesso-negado";
        return;
      }

      if (error.message === "Sessao invalida" || error.message === "Autenticacao obrigatoria") {
        window.location.href = "/login";
        return;
      }

      setMessage(message, "error", error.message);
    } finally {
      loading.hidden = true;
    }
  }

  companyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = serializeForm(companyForm);

    try {
      await requestJson(`/api/empresas/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadPage();
      setMessage(message, "success", "Dados da empresa atualizados.");
    } catch (error) {
      setMessage(message, "error", error.message);
    }
  });

  platformSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = serializeForm(platformSettingsForm);
    payload.dashboardExibirFinanceiro = payload.dashboardExibirFinanceiro === "true";

    try {
      await requestJson("/api/configuracoes", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadPage();
      setMessage(message, "success", "Configuracoes salvas com sucesso.");
    } catch (error) {
      setMessage(message, "error", error.message);
    }
  });

  userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = serializeForm(userForm);
    const userId = payload.id;
    delete payload.id;

    if (!payload.senha) {
      delete payload.senha;
    }

    try {
      if (userId) {
        await requestJson(`/api/usuarios/${userId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson("/api/usuarios", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      resetUserForm();
      await loadPage();
      setMessage(message, "success", "Usuario salvo com sucesso.");
    } catch (error) {
      setMessage(message, "error", error.message);
    }
  });

  resetUserFormButton.addEventListener("click", resetUserForm);
  resetUserForm();
  loadPage();
}

document.addEventListener("DOMContentLoaded", createSettingsPage);
