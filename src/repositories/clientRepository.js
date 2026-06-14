const database = require("../config/database");
const { buildTenantCondition, normalizeActor } = require("./tenantContext");

function formatDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  return value || "";
}

function mapClient(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nome: row.nome,
    documento: formatDocument(row.documento),
    email: row.email,
    telefone: row.telefone,
    contatoNome: row.contatoNome,
    cidade: row.cidade,
    estado: row.estado,
    endereco: row.endereco,
    status: row.status,
    observacoes: row.observacoes || "",
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function listByUserId(actor) {
  const tenant = buildTenantCondition({ actor, tableAlias: "c" });
  const result = await database.query(
    `SELECT
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM clientes c
    WHERE ${tenant.condition}
    ORDER BY nome ASC`,
    tenant.params,
  );

  return result.rows.map(mapClient);
}

async function findById(actor, clientId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "c" });
  const clientIdIndex = tenant.nextIndex;
  const result = await database.query(
    `SELECT
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM clientes c
    WHERE ${tenant.condition} AND id = $${clientIdIndex}`,
    [...tenant.params, clientId],
  );

  return mapClient(result.rows[0]);
}

async function create(actor, payload) {
  const context = normalizeActor(actor);
  const result = await database.query(
    `INSERT INTO clientes (
      usuario_id,
      empresa_id,
      nome,
      documento,
      email,
      telefone,
      contato_nome,
      cidade,
      estado,
      endereco,
      status,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      context.userId,
      context.empresaId,
      payload.nome,
      payload.documento,
      payload.email,
      payload.telefone,
      payload.contatoNome,
      payload.cidade,
      payload.estado,
      payload.endereco,
      payload.status,
      payload.observacoes,
    ],
  );

  return mapClient(result.rows[0]);
}

async function updateById(actor, clientId, payload) {
  const tenant = buildTenantCondition({ actor, tableAlias: "clientes", startIndex: 2 });
  const fields = [];
  const values = [clientId, ...tenant.params];
  const mapping = {
    nome: "nome",
    documento: "documento",
    email: "email",
    telefone: "telefone",
    contatoNome: "contato_nome",
    cidade: "cidade",
    estado: "estado",
    endereco: "endereco",
    status: "status",
    observacoes: "observacoes",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);
  }

  fields.push("atualizado_em = NOW()");

  const result = await database.query(
    `UPDATE clientes
    SET ${fields.join(", ")}
    WHERE id = $1 AND ${tenant.condition}
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    values,
  );

  return mapClient(result.rows[0]);
}

async function updateStatusById(actor, clientId, status) {
  const tenant = buildTenantCondition({ actor, tableAlias: "clientes", startIndex: 3 });
  const result = await database.query(
    `UPDATE clientes
    SET status = $2, atualizado_em = NOW()
    WHERE id = $1 AND ${tenant.condition}
    RETURNING
      id,
      nome,
      documento,
      email,
      telefone,
      contato_nome AS "contatoNome",
      cidade,
      estado,
      endereco,
      status,
      observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [clientId, status, ...tenant.params],
  );

  return mapClient(result.rows[0]);
}

async function deleteById(actor, clientId) {
  const tenant = buildTenantCondition({ actor, tableAlias: "clientes", startIndex: 2 });
  const result = await database.query(
    `DELETE FROM clientes
    WHERE id = $1 AND ${tenant.condition}
    RETURNING id`,
    [clientId, ...tenant.params],
  );

  return result.rows[0] || null;
}

module.exports = {
  listByUserId,
  findById,
  create,
  updateById,
  updateStatusById,
  deleteById,
};
