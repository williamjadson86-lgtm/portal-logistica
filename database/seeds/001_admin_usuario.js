const bcrypt = require("bcryptjs");
const { createDefaultCompany } = require("../../src/repositories/companyRepository");

const DEFAULT_ADMIN_USER = {
  nome: "Administrador Portal Logistica",
  cpf: "000.000.000-00",
  email: "admin@portallogistica.com",
  telefone: "(11) 90000-0000",
  matricula: "ADM0001",
  senha: "Admin@123",
  tipoUsuario: "administrador",
};

function buildAdminSeed(env = process.env) {
  return {
    nome: env.ADMIN_SEED_NOME || DEFAULT_ADMIN_USER.nome,
    cpf: env.ADMIN_SEED_CPF || DEFAULT_ADMIN_USER.cpf,
    email: (env.ADMIN_SEED_EMAIL || DEFAULT_ADMIN_USER.email).trim().toLowerCase(),
    telefone: env.ADMIN_SEED_TELEFONE || DEFAULT_ADMIN_USER.telefone,
    matricula: (env.ADMIN_SEED_MATRICULA || DEFAULT_ADMIN_USER.matricula).trim().toUpperCase(),
    senha: env.ADMIN_SEED_PASSWORD || DEFAULT_ADMIN_USER.senha,
    tipoUsuario: env.ADMIN_SEED_TIPO_USUARIO || DEFAULT_ADMIN_USER.tipoUsuario,
  };
}

async function seedAdminUser(client, env = process.env) {
  const admin = buildAdminSeed(env);
  const senhaHash = await bcrypt.hash(admin.senha, 10);
  const empresa = await createDefaultCompany(admin, client);

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
    ON CONFLICT (email)
    DO UPDATE SET
      empresa_id = COALESCE(usuarios.empresa_id, EXCLUDED.empresa_id),
      nome = EXCLUDED.nome,
      cpf = EXCLUDED.cpf,
      telefone = EXCLUDED.telefone,
      matricula = EXCLUDED.matricula,
      senha_hash = EXCLUDED.senha_hash,
      tipo_usuario = EXCLUDED.tipo_usuario,
      ativo = TRUE,
      atualizado_em = NOW()
    RETURNING id, empresa_id AS "empresaId", email, matricula, tipo_usuario AS "tipoUsuario"`,
    [
      empresa.id,
      admin.nome,
      admin.cpf,
      admin.email,
      admin.telefone,
      admin.matricula,
      senhaHash,
      admin.tipoUsuario,
    ],
  );

  return {
    ...result.rows[0],
    senhaHash,
  };
}

module.exports = {
  DEFAULT_ADMIN_USER,
  buildAdminSeed,
  seedAdminUser,
};
