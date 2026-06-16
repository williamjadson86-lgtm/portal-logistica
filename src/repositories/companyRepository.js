const database = require("../config/database");
const HttpError = require("../errors/HttpError");
const { normalizeActor } = require("./tenantContext");

function mapCompany(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    cnpj: row.cnpj,
    email: row.email,
    telefone: row.telefone,
    endereco: row.endereco,
    cidade: row.cidade,
    estado: row.estado,
    cep: row.cep,
    logoUrl: row.logoUrl,
    status: row.status,
    ativo: row.status === "ativo",
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

const selectFields = `SELECT
  id,
  razao_social AS "razaoSocial",
  nome_fantasia AS "nomeFantasia",
  cnpj,
  email,
  telefone,
  endereco,
  cidade,
  estado,
  cep,
  logo_url AS "logoUrl",
  status,
  criado_em AS "criadoEm",
  atualizado_em AS "atualizadoEm"
FROM empresas`;

function buildDefaultCompanyPayload(userLike) {
  const documento = userLike?.cpf || null;
  const cnpj = /^\d{14}$/.test(String(documento || "").replace(/\D/g, ""))
    ? documento
    : null;

  return {
    nome:
      userLike?.nome && String(userLike.nome).trim()
        ? `Empresa de ${String(userLike.nome).trim()}`
        : "Empresa Principal",
    documento,
    cnpj,
    email: userLike?.email || null,
    telefone: userLike?.telefone || null,
  };
}

async function createDefaultCompany(userLike, client = database) {
  const payload = buildDefaultCompanyPayload(userLike);
  const result = await client.query(
    `INSERT INTO empresas (
      nome,
      documento,
      email,
      telefone,
      ativo,
      razao_social,
      nome_fantasia,
      cnpj,
      status
    )
    VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, 'ativo')
    RETURNING
      id,
      razao_social AS "razaoSocial",
      nome_fantasia AS "nomeFantasia",
      cnpj,
      email,
      telefone,
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      payload.nome,
      payload.documento,
      payload.email,
      payload.telefone,
      payload.nome,
      payload.nome,
      payload.cnpj,
    ],
  );

  return mapCompany(result.rows[0]);
}

async function listByActor(actor) {
  const context = normalizeActor(actor);
  if (!context.empresaId) {
    return [];
  }

  const result = await database.query(
    `${selectFields}
    WHERE id = $1
    ORDER BY razao_social ASC`,
    [context.empresaId],
  );

  return result.rows.map(mapCompany);
}

async function findByIdForActor(actor, companyId) {
  const context = normalizeActor(actor);
  if (!context.empresaId || context.empresaId !== companyId) {
    return null;
  }

  const result = await database.query(
    `${selectFields}
    WHERE id = $1`,
    [companyId],
  );

  return mapCompany(result.rows[0]);
}

async function createForActor(actor, payload) {
  const context = normalizeActor(actor);
  if (context.empresaId) {
    throw new HttpError(409, "Usuario autenticado ja possui empresa vinculada");
  }

  const result = await database.query(
    `INSERT INTO empresas (
      nome,
      documento,
      email,
      telefone,
      ativo,
      razao_social,
      nome_fantasia,
      cnpj,
      endereco,
      cidade,
      estado,
      cep,
      logo_url,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $1, $6, $2, $7, $8, $9, $10, $11, $12)
    RETURNING
      id,
      razao_social AS "razaoSocial",
      nome_fantasia AS "nomeFantasia",
      cnpj,
      email,
      telefone,
      endereco,
      cidade,
      estado,
      cep,
      logo_url AS "logoUrl",
      status,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      payload.razaoSocial,
      payload.cnpj,
      payload.email,
      payload.telefone,
      payload.status === "ativo",
      payload.nomeFantasia,
      payload.endereco,
      payload.cidade,
      payload.estado,
      payload.cep,
      payload.logoUrl,
      payload.status,
    ],
  );

  return mapCompany(result.rows[0]);
}

async function updateByIdForActor(actor, companyId, payload) {
  const context = normalizeActor(actor);
  if (!context.empresaId || context.empresaId !== companyId) {
    return null;
  }

  const fields = [];
  const values = [companyId];
  const mapping = {
    razaoSocial: ["razao_social", "nome"],
    nomeFantasia: ["nome_fantasia"],
    cnpj: ["cnpj", "documento"],
    email: ["email"],
    telefone: ["telefone"],
    endereco: ["endereco"],
    cidade: ["cidade"],
    estado: ["estado"],
    cep: ["cep"],
    logoUrl: ["logo_url"],
    status: ["status"],
  };

  for (const [key, columns] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    for (const column of columns) {
      values.push(column === "documento" ? payload.cnpj : payload[key]);
      fields.push(`${column} = $${values.length}`);
    }

    if (key === "status") {
      values.push(payload.status === "ativo");
      fields.push(`ativo = $${values.length}`);
    }
  }

  fields.push("atualizado_em = NOW()");

  await database.query(
    `UPDATE empresas
    SET ${fields.join(", ")}
    WHERE id = $1`,
    values,
  );

  return findByIdForActor(actor, companyId);
}

async function deleteByIdForActor(actor, companyId) {
  return updateByIdForActor(actor, companyId, { status: "inativo" });
}

module.exports = {
  buildDefaultCompanyPayload,
  createDefaultCompany,
  listByActor,
  findByIdForActor,
  createForActor,
  updateByIdForActor,
  deleteByIdForActor,
};
