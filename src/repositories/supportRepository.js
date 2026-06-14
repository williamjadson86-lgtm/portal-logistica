const database = require("../config/database");
const { buildTenantCondition } = require("./tenantContext");

async function listByUserId(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "cs" });
  const result = await database.query(
    `SELECT
      assunto,
      categoria,
      prioridade,
      status,
      mensagem,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM chamados_suporte cs
    WHERE ${tenant.condition}
    ORDER BY atualizado_em DESC`,
    tenant.params,
  );

  return result.rows;
}

module.exports = { listByUserId };
