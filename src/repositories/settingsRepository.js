const database = require("../config/database");

async function findByUserId(userId) {
  await database.query(
    `INSERT INTO configuracoes_usuario (usuario_id)
     VALUES ($1)
     ON CONFLICT (usuario_id) DO NOTHING`,
    [userId],
  );

  const result = await database.query(
    `SELECT
      tema,
      notificacoes_email AS "notificacoesEmail",
      notificacoes_push AS "notificacoesPush",
      idioma,
      atualizado_em AS "atualizadoEm"
    FROM configuracoes_usuario
    WHERE usuario_id = $1`,
    [userId],
  );

  return result.rows[0] || null;
}

module.exports = { findByUserId };
