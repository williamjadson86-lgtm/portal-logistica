const database = require("../config/database");

async function findByUserId(userId) {
  const profileResult = await database.query(
    `SELECT
      nome,
      cpf,
      email,
      telefone,
      matricula,
      tipo_usuario AS "tipoUsuario",
      ativo,
      criado_em AS "criadoEm"
    FROM usuarios
    WHERE id = $1`,
    [userId],
  );

  const countersResult = await database.query(
    `SELECT
      (SELECT COUNT(*)::int FROM entregas WHERE usuario_id = $1) AS entregas,
      (SELECT COUNT(*)::int FROM documentos WHERE usuario_id = $1) AS documentos,
      (SELECT COUNT(*)::int FROM chamados_suporte WHERE usuario_id = $1 AND status <> 'resolvido') AS chamados_abertos,
      (SELECT COUNT(*)::int FROM lancamentos_financeiros WHERE usuario_id = $1) AS lancamentos`,
    [userId],
  );

  return {
    profile: profileResult.rows[0] || null,
    counters: countersResult.rows[0],
  };
}

module.exports = { findByUserId };
