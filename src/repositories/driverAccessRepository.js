const database = require("../config/database");
const { onlyDigits } = require("../utils/cpf");

async function findLinkedDriverId(user) {
  const cpf = onlyDigits(user?.cpf);

  if (!user?.id || !cpf) {
    return null;
  }

  const result = await database.query(
    `SELECT id
    FROM motoristas
    WHERE usuario_id = $1
      AND regexp_replace(cpf, '\D', '', 'g') = $2
    ORDER BY criado_em ASC
    LIMIT 1`,
    [user.id, cpf],
  );

  return result.rows[0]?.id || null;
}

module.exports = {
  findLinkedDriverId,
};
