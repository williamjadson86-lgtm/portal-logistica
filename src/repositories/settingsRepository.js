const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const companyRepository = require("./companyRepository");
const userRepository = require("./userRepository");
const {
  ROLE_PERMISSIONS,
  CARD_PERMISSIONS,
  normalizeUserRole,
} = require("../config/permissions");
const { normalizeActor } = require("./tenantContext");

async function ensureCompanySettings(empresaId) {
  await database.query(
    `INSERT INTO configuracoes_empresa (empresa_id)
     VALUES ($1)
     ON CONFLICT (empresa_id) DO NOTHING`,
    [empresaId],
  );
}

async function findByUserId(actor) {
  const context = normalizeActor(actor);
  if (!context.empresaId) {
    throw new HttpError(400, "Usuario autenticado sem empresa vinculada");
  }

  await ensureCompanySettings(context.empresaId);

  const [company, settingsResult, userSummary] = await Promise.all([
    companyRepository.findByIdForActor(context, context.empresaId),
    database.query(
      `SELECT
        timezone,
        moeda,
        formato_data AS "formatoData",
        dashboard_periodo_padrao AS "dashboardPeriodoPadrao",
        dashboard_exibir_financeiro AS "dashboardExibirFinanceiro",
        atualizado_em AS "atualizadoEm"
      FROM configuracoes_empresa
      WHERE empresa_id = $1`,
      [context.empresaId],
    ),
    userRepository.getCompanyUserSummary(context),
  ]);

  return {
    empresa: company,
    configuracoes: settingsResult.rows[0] || null,
    resumoUsuarios: {
      total: Number(userSummary.total || 0),
      ativos: Number(userSummary.ativos || 0),
      bloqueados: Number(userSummary.bloqueados || 0),
    },
  };
}

async function updateByUserId(actor, payload) {
  const context = normalizeActor(actor);
  if (!context.empresaId) {
    throw new HttpError(400, "Usuario autenticado sem empresa vinculada");
  }

  await ensureCompanySettings(context.empresaId);

  const fields = [];
  const values = [context.empresaId];
  const mapping = {
    timezone: "timezone",
    moeda: "moeda",
    formatoData: "formato_data",
    dashboardPeriodoPadrao: "dashboard_periodo_padrao",
    dashboardExibirFinanceiro: "dashboard_exibir_financeiro",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);
  }

  fields.push("atualizado_em = NOW()");

  await database.query(
    `UPDATE configuracoes_empresa
    SET ${fields.join(", ")}
    WHERE empresa_id = $1`,
    values,
  );

  return findByUserId(actor);
}

function listPermissions() {
  const uniquePermissions = new Set(
    Object.values(ROLE_PERMISSIONS).flat().filter((permission) => permission !== "*"),
  );

  const perfis = Object.keys(ROLE_PERMISSIONS).map((perfil) => {
    const permissoes = ROLE_PERMISSIONS[perfil];
    const efetivas = permissoes.includes("*") ? [...uniquePermissions] : permissoes;
    const modulosLiberados = Object.entries(CARD_PERMISSIONS)
      .filter(([, permission]) => efetivas.includes(permission) || permissoes.includes("*"))
      .map(([href]) => href);

    return {
      perfil,
      role: normalizeUserRole(perfil),
      modulosLiberados,
      permissoesEfetivas: efetivas,
      restricoes: [...uniquePermissions].filter((permission) => !efetivas.includes(permission)),
    };
  });

  return {
    perfis,
    permissoes: [...uniquePermissions].sort(),
  };
}

module.exports = {
  findByUserId,
  updateByUserId,
  listPermissions,
};
