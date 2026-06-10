const database = require("../config/database");

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      nome,
      tipo,
      status,
      TO_CHAR(validade_em, 'YYYY-MM-DD') AS "validadeEm",
      criado_em AS "criadoEm"
    FROM documentos
    WHERE usuario_id = $1
    ORDER BY criado_em DESC`,
    [userId],
  );

  return result.rows;
}

module.exports = { listByUserId };
