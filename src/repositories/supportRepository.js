const database = require("../config/database");

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      assunto,
      categoria,
      prioridade,
      status,
      mensagem,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM chamados_suporte
    WHERE usuario_id = $1
    ORDER BY atualizado_em DESC`,
    [userId],
  );

  return result.rows;
}

module.exports = { listByUserId };
