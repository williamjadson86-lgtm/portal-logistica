const database = require("../config/database");

async function listActive() {
  const result = await database.query(
    `SELECT
      titulo,
      conteudo,
      prioridade,
      publicado_em AS "publicadoEm"
    FROM avisos
    WHERE ativo = TRUE
    ORDER BY publicado_em DESC`,
  );

  return result.rows;
}

module.exports = { listActive };
