const database = require("../config/database");

async function listActive(actor = null) {
  const params = [];
  const conditions = ["ativo = TRUE"];

  if (actor?.empresaId) {
    params.push(actor.empresaId);
    conditions.push(`(empresa_id IS NULL OR empresa_id = $${params.length})`);
  }

  const result = await database.query(
    `SELECT
      titulo,
      conteudo,
      prioridade,
      publicado_em AS "publicadoEm"
    FROM avisos
    WHERE ${conditions.join(" AND ")}
    ORDER BY publicado_em DESC`,
    params,
  );

  return result.rows;
}

module.exports = { listActive };
