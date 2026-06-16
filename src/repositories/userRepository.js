const database = require("../config/database");
const bcrypt = require("bcryptjs");
const HttpError = require("../errors/HttpError");
const companyRepository = require("./companyRepository");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

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

function mapManagedUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    email: row.email,
    documento: row.cpf,
    cpf: row.cpf,
    telefone: row.telefone,
    matricula: row.matricula,
    perfil: row.tipoUsuario,
    tipoUsuario: row.tipoUsuario,
    role: row.tipoUsuario,
    ativo: row.ativo,
    status: row.ativo ? "ativo" : "bloqueado",
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

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

async function listByActor(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "u", empresaColumn: "empresa_id", userColumn: "id" });
  const result = await database.query(
    `SELECT ${publicFields}
    FROM usuarios u
    WHERE ${tenant.condition}
    ORDER BY ativo DESC, nome ASC`,
    tenant.params,
  );

  return result.rows.map(mapManagedUser);
}

async function findByIdForActor(actor, userId) {
  const tenant = buildTenantCondition({
    actor,
    tableAlias: "u",
    startIndex: 2,
    empresaColumn: "empresa_id",
    userColumn: "id",
  });
  const result = await database.query(
    `SELECT ${publicFields}
    FROM usuarios u
    WHERE u.id = $1
      AND ${tenant.condition}`,
    [userId, ...tenant.params],
  );

  return mapManagedUser(result.rows[0]);
}

async function ensureUniqueManagedUser(data, ignoredUserId = null) {
  const emailResult = await database.query(
    `SELECT id FROM usuarios WHERE email = $1${ignoredUserId ? " AND id <> $2" : ""} LIMIT 1`,
    ignoredUserId ? [data.email, ignoredUserId] : [data.email],
  );
  if (emailResult.rowCount > 0) {
    throw new HttpError(409, "E-mail ja cadastrado");
  }

  const matriculaResult = await database.query(
    `SELECT id FROM usuarios WHERE matricula = $1${ignoredUserId ? " AND id <> $2" : ""} LIMIT 1`,
    ignoredUserId ? [data.matricula, ignoredUserId] : [data.matricula],
  );
  if (matriculaResult.rowCount > 0) {
    throw new HttpError(409, "Matricula ja cadastrada");
  }
}

async function createManagedUser(actor, payload) {
  const context = normalizeActor(actor);
  if (!context.empresaId) {
    throw new HttpError(400, "Usuario autenticado sem empresa vinculada");
  }

  await ensureUniqueManagedUser(payload);
  const senhaHash = await bcrypt.hash(payload.senha, 10);
  const result = await database.query(
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING ${publicFields}`,
    [
      context.empresaId,
      payload.nome,
      payload.documento,
      payload.email,
      payload.telefone,
      payload.matricula,
      senhaHash,
      payload.tipoUsuario,
      payload.status === "ativo",
    ],
  );

  return mapManagedUser(result.rows[0]);
}

async function updateByIdForActor(actor, userId, payload) {
  const current = await findByIdForActor(actor, userId);
  if (!current) {
    return null;
  }

  await ensureUniqueManagedUser(
    {
      email: payload.email || current.email,
      matricula: payload.matricula || current.matricula,
    },
    userId,
  );

  const fields = [];
  const values = [userId];
  const mapping = {
    nome: "nome",
    documento: "cpf",
    email: "email",
    telefone: "telefone",
    matricula: "matricula",
    tipoUsuario: "tipo_usuario",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);
  }

  if (Object.hasOwn(payload, "status")) {
    values.push(payload.status === "ativo");
    fields.push(`ativo = $${values.length}`);
  }

  fields.push("atualizado_em = NOW()");

  const tenant = buildTenantCondition({
    actor,
    tableAlias: "usuarios",
    startIndex: values.length + 1,
    empresaColumn: "empresa_id",
    userColumn: "id",
  });

  await database.query(
    `UPDATE usuarios
    SET ${fields.join(", ")}
    WHERE id = $1
      AND ${tenant.condition}`,
    [...values, ...tenant.params],
  );

  return findByIdForActor(actor, userId);
}

async function updateStatusByIdForActor(actor, userId, status) {
  return updateByIdForActor(actor, userId, { status });
}

async function updateRoleByIdForActor(actor, userId, tipoUsuario) {
  return updateByIdForActor(actor, userId, { tipoUsuario });
}

async function resetPasswordByIdForActor(actor, userId, novaSenha) {
  const current = await findByIdForActor(actor, userId);
  if (!current) {
    return null;
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  const tenant = buildTenantCondition({
    actor,
    tableAlias: "usuarios",
    startIndex: 3,
    empresaColumn: "empresa_id",
    userColumn: "id",
  });

  await database.query(
    `UPDATE usuarios
    SET senha_hash = $2,
        atualizado_em = NOW()
    WHERE id = $1
      AND ${tenant.condition}`,
    [userId, senhaHash, ...tenant.params],
  );

  return findByIdForActor(actor, userId);
}

async function getCompanyUserSummary(actor) {
  const tenant = buildTenantCondition({
    actor,
    tableAlias: "u",
    empresaColumn: "empresa_id",
    userColumn: "id",
  });
  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ativo = TRUE)::int AS ativos,
      COUNT(*) FILTER (WHERE ativo = FALSE)::int AS bloqueados
    FROM usuarios u
    WHERE ${tenant.condition}`,
    tenant.params,
  );

  return result.rows[0] || { total: 0, ativos: 0, bloqueados: 0 };
}

module.exports = {
  create,
  findByEmail,
  findByMatricula,
  findById,
  listByActor,
  findByIdForActor,
  createManagedUser,
  updateByIdForActor,
  updateStatusByIdForActor,
  updateRoleByIdForActor,
  resetPasswordByIdForActor,
  getCompanyUserSummary,
};
