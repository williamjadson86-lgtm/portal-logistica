const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { applyMigrations, loadMigrationFiles } = require("../scripts/dbMigrate");

function createFakeClient(appliedVersions = []) {
  const queries = [];
  const inserted = [];

  return {
    queries,
    inserted,
    async query(sql, params = []) {
      queries.push({ sql, params });

      if (sql.includes("SELECT version FROM schema_migrations")) {
        return { rows: appliedVersions.map((version) => ({ version })), rowCount: appliedVersions.length };
      }

      if (sql.includes("INSERT INTO schema_migrations")) {
        inserted.push({ version: params[0], name: params[1] });
        appliedVersions.push(params[0]);
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

test("loadMigrationFiles ordena migrations pelo nome do arquivo", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portal-migrations-"));

  try {
    fs.writeFileSync(path.join(tempDir, "002_create_b.sql"), "SELECT 2;");
    fs.writeFileSync(path.join(tempDir, "001_create_a.sql"), "SELECT 1;");

    const migrations = loadMigrationFiles(tempDir);

    assert.deepEqual(
      migrations.map((migration) => migration.name),
      ["001_create_a.sql", "002_create_b.sql"],
    );
    assert.equal(migrations[0].version, "001");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("applyMigrations aplica apenas migrations pendentes e registra no controle", async () => {
  const client = createFakeClient(["001"]);
  const migrations = [
    { version: "001", name: "001_create_a.sql", sql: "SELECT 1;" },
    { version: "002", name: "002_create_b.sql", sql: "SELECT 2;" },
  ];

  const appliedCount = await applyMigrations(client, migrations);

  assert.equal(appliedCount, 1);
  assert.deepEqual(client.inserted, [{ version: "002", name: "002_create_b.sql" }]);
  assert.ok(client.queries.some((entry) => entry.sql === "BEGIN"));
  assert.ok(client.queries.some((entry) => entry.sql === "COMMIT"));
});
