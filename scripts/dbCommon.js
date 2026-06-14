const path = require("path");
const { Client } = require("pg");
const env = require("../src/config/env");

function getSslConfig() {
  return env.databaseSsl ? { rejectUnauthorized: false } : false;
}

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
    ssl: getSslConfig(),
  });
  const databaseName = extractDatabaseName(env.databaseUrl);

  await adminClient.connect();

  try {
    const existsResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (existsResult.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Banco de dados "${databaseName}" criado com sucesso.`);
    }
  } finally {
    await adminClient.end();
  }
}

function createDatabaseClient() {
  return new Client({
    connectionString: env.databaseUrl,
    ssl: getSslConfig(),
  });
}

function resolveProjectPath(...segments) {
  return path.join(__dirname, "..", ...segments);
}

module.exports = {
  createDatabaseClient,
  ensureDatabaseExists,
  resolveProjectPath,
};
