const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const env = require("../src/config/env");

function buildAdminConnectionString(connectionString) {
  const url = new URL(connectionString);
  url.pathname = "/postgres";
  return url.toString();
}

function extractDatabaseName(connectionString) {
  const url = new URL(connectionString);
  return url.pathname.replace(/^\//, "");
}

async function ensureDatabaseExists() {
  const adminClient = new Client({
    connectionString: buildAdminConnectionString(env.databaseUrl),
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  });
  const databaseName = extractDatabaseName(env.databaseUrl);

  await adminClient.connect();

  const existsResult = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [databaseName],
  );

  if (existsResult.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`Banco de dados "${databaseName}" criado com sucesso.`);
  }

  await adminClient.end();
}

async function main() {
  const sqlPath = path.join(__dirname, "..", "database", "init.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  await ensureDatabaseExists();

  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  await client.query(sql);
  await client.end();

  console.log("database/init.sql executado com sucesso.");
}

main().catch((error) => {
  console.error("Falha ao inicializar o banco:", error.message);
  process.exit(1);
});
