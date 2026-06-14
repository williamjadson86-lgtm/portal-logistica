const database = require("../config/database");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

async function findByUserId(actor) {
  const context = normalizeActor(actor);
  const profileResult = await database.query(
    `SELECT
      nome,
      cpf,
      email,
      telefone,
      matricula,
      tipo_usuario AS "tipoUsuario",
      empresa_id AS "empresaId",
      ativo,
      criado_em AS "criadoEm"
    FROM usuarios
    WHERE id = $1`,
    [context.userId],
  );

  const tenant = buildTenantCondition({ actor: context });
  const countersResult = await database.query(
    `SELECT
      (SELECT COUNT(*)::int FROM entregas WHERE ${tenant.condition.replaceAll("usuario_id", "entregas.usuario_id").replaceAll("empresa_id", "entregas.empresa_id")}) AS entregas,
      (SELECT COUNT(*)::int FROM documentos WHERE ${tenant.condition.replaceAll("usuario_id", "documentos.usuario_id").replaceAll("empresa_id", "documentos.empresa_id")}) AS documentos,
      (SELECT COUNT(*)::int FROM chamados_suporte WHERE ${tenant.condition.replaceAll("usuario_id", "chamados_suporte.usuario_id").replaceAll("empresa_id", "chamados_suporte.empresa_id")} AND status <> 'resolvido') AS chamados_abertos,
      (SELECT COUNT(*)::int FROM lancamentos_financeiros WHERE ${tenant.condition.replaceAll("usuario_id", "lancamentos_financeiros.usuario_id").replaceAll("empresa_id", "lancamentos_financeiros.empresa_id")}) AS lancamentos`,
    tenant.params,
  );

  return {
    profile: profileResult.rows[0] || null,
    counters: countersResult.rows[0],
  };
}

module.exports = { findByUserId };
