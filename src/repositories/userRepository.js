const database = require("../config/database");
const companyRepository = require("./companyRepository");

const baseFields = `
  id,
  empresa_id AS "empresaId",
  nome,
  cpf,
  email,
  telefone,
  matricula,
  senha_hash AS "senhaHash",
  tipo_usuario AS "tipoUsuario",
  ativo,
  criado_em AS "criadoEm",
  atualizado_em AS "atualizadoEm"
`;

const publicFields = `
  id,
  empresa_id AS "empresaId",
  nome,
  cpf,
  email,
  telefone,
  matricula,
  tipo_usuario AS "tipoUsuario",
  ativo,
  criado_em AS "criadoEm",
  atualizado_em AS "atualizadoEm"
`;

async function create(user) {
  const client = await database.getClient();

  try {
    await client.query("BEGIN");
    const empresa = user.empresaId
      ? { id: user.empresaId }
      : await companyRepository.createDefaultCompany(user, client);

    const result = await client.query(
      `INSERT INTO usuarios (
        empresa_id,
        nome,
        cpf,
        email,
        telefone,
        matricula,
        senha_hash,
        tipo_usuario,
        ativo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING ${publicFields}`,
      [
        empresa.id,
        user.nome,
        user.cpf,
        user.email,
        user.telefone,
        user.matricula,
        user.senhaHash,
        user.tipoUsuario,
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findByEmail(email) {
  const result = await database.query(
    `SELECT ${baseFields} FROM usuarios WHERE email = $1`,
    [email],
  );

  return result.rows[0] || null;
}

async function findByMatricula(matricula) {
  const result = await database.query(
    `SELECT ${baseFields} FROM usuarios WHERE matricula = $1`,
    [matricula],
  );

  return result.rows[0] || null;
}

async function findById(id) {
  const result = await database.query(
    `SELECT ${publicFields} FROM usuarios WHERE id = $1`,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = { create, findByEmail, findByMatricula, findById };
