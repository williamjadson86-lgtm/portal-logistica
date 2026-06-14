const database = require("../config/database");
const { normalizeActor } = require("./tenantContext");

async function findByUserId(actor) {
  const context = normalizeActor(actor);
  await database.query(
    `INSERT INTO configuracoes_usuario (usuario_id, empresa_id)
     VALUES ($1, $2)
     ON CONFLICT (usuario_id) DO NOTHING`,
    [context.userId, context.empresaId],
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
    [context.userId],
  );

  return result.rows[0] || null;
}

module.exports = { findByUserId };
