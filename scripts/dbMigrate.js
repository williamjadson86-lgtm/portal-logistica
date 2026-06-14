const fs = require("fs");
const path = require("path");
const { createDatabaseClient, ensureDatabaseExists, resolveProjectPath } = require("./dbCommon");

const MIGRATIONS_TABLE = "schema_migrations";

function loadMigrationFiles(migrationsDir) {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => ({
      version: entry.name.split("_")[0],
      name: entry.name,
      filePath: path.join(migrationsDir, entry.name),
      sql: fs.readFileSync(path.join(migrationsDir, entry.name), "utf8"),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function ensureMigrationsTable(client) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(32) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
}

async function getAppliedVersions(client) {
  const result = await client.query(`SELECT version FROM ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((row) => row.version));
}

async function applyMigrations(client, migrations) {
  await ensureMigrationsTable(client);
  const appliedVersions = await getAppliedVersions(client);
  const pendingMigrations = migrations.filter((migration) => !appliedVersions.has(migration.version));

  for (const migration of pendingMigrations) {
    await client.query("BEGIN");

    try {
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name)
        VALUES ($1, $2)`,
        [migration.version, migration.name],
      );
      await client.query("COMMIT");
      console.log(`Migration aplicada: ${migration.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Falha ao aplicar ${migration.name}: ${error.message}`);
    }
  }

  return pendingMigrations.length;
}

async function main() {
  const migrationsDir = resolveProjectPath("database", "migrations");
  const migrations = loadMigrationFiles(migrationsDir);

  await ensureDatabaseExists();

  const client = createDatabaseClient();
  await client.connect();

  try {
    const appliedCount = await applyMigrations(client, migrations);

    if (appliedCount === 0) {
      console.log("Nenhuma migration pendente.");
    } else {
      console.log(`${appliedCount} migration(s) aplicadas com sucesso.`);
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Falha ao executar migrations:", error.message);
    process.exit(1);
  });
}

module.exports = {
  MIGRATIONS_TABLE,
  applyMigrations,
  ensureMigrationsTable,
  getAppliedVersions,
  loadMigrationFiles,
};
