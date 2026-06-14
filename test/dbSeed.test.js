const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const {
  DEFAULT_ADMIN_USER,
  buildAdminSeed,
  seedAdminUser,
} = require("../database/seeds/001_admin_usuario");

test("buildAdminSeed normaliza email e matricula", () => {
  const admin = buildAdminSeed({
    ADMIN_SEED_EMAIL: " ADMIN@PORTALLOGISTICA.COM ",
    ADMIN_SEED_MATRICULA: " adm9001 ",
  });

  assert.equal(admin.email, "admin@portallogistica.com");
  assert.equal(admin.matricula, "ADM9001");
  assert.equal(admin.senha, DEFAULT_ADMIN_USER.senha);
});

test("seedAdminUser gera hash bcrypt e envia upsert do administrador", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("INSERT INTO empresas")) {
        return {
          rows: [
            {
              id: "empresa-seed-001",
            },
          ],
        };
      }

      return {
        rows: [
          {
            id: "d2f96efa-1c24-4c0f-a498-2b90dbdca8cb",
            empresaId: params[0],
            email: params[3],
            matricula: params[5],
            tipoUsuario: params[7],
          },
        ],
      };
    },
  };

  const result = await seedAdminUser(client, {
    ADMIN_SEED_PASSWORD: "SenhaSegura@2026",
  });

  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /ON CONFLICT \(email\)/);
  assert.notEqual(calls[1].params[6], "SenhaSegura@2026");
  assert.equal(await bcrypt.compare("SenhaSegura@2026", calls[1].params[6]), true);
  assert.equal(result.email, DEFAULT_ADMIN_USER.email);
  assert.equal(result.empresaId, "empresa-seed-001");
  assert.match(result.senhaHash, /^\$2[aby]\$/);
});
