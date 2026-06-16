const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const database = require("../src/config/database");
const clientRepository = require("../src/repositories/clientRepository");
const deliveryRepository = require("../src/repositories/deliveryRepository");
const deliveryEventRepository = require("../src/repositories/deliveryEventRepository");
const financeRepository = require("../src/repositories/financeRepository");
const { findLinkedDriverId } = require("../src/repositories/driverAccessRepository");

const originalQuery = database.query;

function useQuerySpy(implementation) {
  database.query = implementation;
}

test.afterEach(() => {
  database.query = originalQuery;
});

test("clientes usam empresa_id com fallback para usuario_id legado", async () => {
  let captured;
  useQuerySpy(async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  });

  await clientRepository.listByUserId({
    id: "user-001",
    empresaId: "empresa-001",
  });

  assert.match(captured.sql, /empresa_id = \$1/);
  assert.match(captured.sql, /empresa_id IS NULL AND c\.usuario_id = \$2/);
  assert.deepEqual(captured.params, ["empresa-001", "user-001"]);
});

test("entregas mantem fallback para base antiga sem empresa_id", async () => {
  let captured;
  useQuerySpy(async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  });

  await deliveryRepository.listByUserId({
    id: "user-002",
    empresaId: "empresa-002",
  });

  assert.match(captured.sql, /d\.empresa_id = \$1/);
  assert.match(captured.sql, /d\.empresa_id IS NULL AND d\.usuario_id = \$2/);
  assert.deepEqual(captured.params, ["empresa-002", "user-002"]);
});

test("financeiro filtra por empresa quando empresaId esta disponivel", async () => {
  let captured;
  useQuerySpy(async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  });

  await financeRepository.listByUserId(
    {
      id: "user-003",
      empresaId: "empresa-003",
    },
    {
      dataInicio: "2026-06-01",
      dataFim: "2026-06-30",
    },
  );

  assert.match(captured.sql, /lf\.empresa_id = \$1/);
  assert.match(captured.sql, /lf\.empresa_id IS NULL AND lf\.usuario_id = \$2/);
  assert.deepEqual(captured.params.slice(0, 2), ["empresa-003", "user-003"]);
});

test("motorista e resolvido pelo CPF dentro da mesma empresa", async () => {
  let captured;
  useQuerySpy(async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ id: "motorista-001" }] };
  });

  const driverId = await findLinkedDriverId({
    id: "user-004",
    empresaId: "empresa-004",
    cpf: "529.982.247-25",
  });

  assert.equal(driverId, "motorista-001");
  assert.match(captured.sql, /m\.empresa_id = \$1/);
  assert.match(captured.sql, /m\.empresa_id IS NULL AND m\.usuario_id = \$2/);
  assert.equal(captured.params[2], "52998224725");
});

test("repositorios ainda funcionam em fallback quando empresaId nao existe", async () => {
  let captured;
  useQuerySpy(async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  });

  await clientRepository.listByUserId({ id: "user-legacy" });

  assert.doesNotMatch(captured.sql, /empresa_id =/);
  assert.match(captured.sql, /c\.usuario_id = \$1/);
  assert.deepEqual(captured.params, ["user-legacy"]);
});

test("eventos de entrega herdam empresa_id do ator autenticado", async () => {
  const calls = [];
  useQuerySpy(async (sql, params) => {
    calls.push({ sql, params });

    if (calls.length === 1) {
      return { rowCount: 1, rows: [{ id: "entrega-001" }] };
    }

    return {
      rows: [
        {
          id: "evento-001",
          entregaId: "entrega-001",
          usuarioId: "user-evt",
          tipoEvento: "teste",
          descricao: "Evento de teste",
          dados: null,
          criadoEm: "2026-06-16T00:00:00.000Z",
        },
      ],
    };
  });

  const result = await deliveryEventRepository.appendEvent(
    { id: "user-evt", empresaId: "empresa-evt" },
    {
      entregaId: "entrega-001",
      tipoEvento: "teste",
      descricao: "Evento de teste",
    },
  );

  assert.equal(result.usuarioId, "user-evt");
  assert.match(calls[0].sql, /d\.empresa_id = \$1/);
  assert.deepEqual(calls[0].params, ["empresa-evt", "user-evt", "entrega-001"]);
  assert.equal(calls[1].params[2], "empresa-evt");
});

test("apoio financeiro verifica lancamentos ativos no mesmo tenant", async () => {
  const calls = [];
  useQuerySpy(async (sql, params) => {
    calls.push({ sql, params });

    if (calls.length === 1) {
      return { rows: [] };
    }

    return { rows: [] };
  });

  await financeRepository.listSupportData({
    id: "user-005",
    empresaId: "empresa-005",
  });

  assert.match(calls[1].sql, /lf\.empresa_id = \$3/);
  assert.match(calls[1].sql, /lf\.empresa_id IS NULL AND lf\.usuario_id = \$4/);
  assert.deepEqual(calls[1].params, [
    "empresa-005",
    "user-005",
    "empresa-005",
    "user-005",
  ]);
});

test("migration 011 cria empresas e adiciona colunas de tenancy", () => {
  const migrationPath = path.join(
    __dirname,
    "..",
    "database",
    "migrations",
    "011_create_empresas_and_tenancy.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS empresas/);
  assert.match(sql, /ALTER TABLE usuarios\s+ADD COLUMN IF NOT EXISTS empresa_id/);
  assert.match(sql, /ALTER TABLE clientes\s+ADD COLUMN IF NOT EXISTS empresa_id/);
  assert.match(sql, /ALTER TABLE entregas\s+ADD COLUMN IF NOT EXISTS empresa_id/);
  assert.match(sql, /UPDATE usuarios u\s+SET empresa_id/);
});
