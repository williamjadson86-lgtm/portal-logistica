const database = require("../config/database");
const { buildTenantCondition } = require("./tenantContext");

async function listByUserId(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "d" });
  const result = await database.query(
    `SELECT
      nome,
      tipo,
      status,
      TO_CHAR(validade_em, 'YYYY-MM-DD') AS "validadeEm",
      criado_em AS "criadoEm"
    FROM documentos d
    WHERE ${tenant.condition}
    ORDER BY criado_em DESC`,
    tenant.params,
  );

  return result.rows;
}

module.exports = { listByUserId };
