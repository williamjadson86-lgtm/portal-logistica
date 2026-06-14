const database = require("../config/database");
const { onlyDigits } = require("../utils/cpf");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

async function findLinkedDriverId(actor) {
  const context = normalizeActor(actor);
  const cpf = onlyDigits(context.cpf);

  if (!context.userId || !cpf) {
    return null;
  }

  const tenant = buildTenantCondition({
    actor: context,
    tableAlias: "m",
  });
  const cpfIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT id
    FROM motoristas m
    WHERE ${tenant.condition}
      AND regexp_replace(cpf, '\D', '', 'g') = $${cpfIndex}
    ORDER BY criado_em ASC
    LIMIT 1`,
    [...tenant.params, cpf],
  );

  return result.rows[0]?.id || null;
}

module.exports = {
  findLinkedDriverId,
};
