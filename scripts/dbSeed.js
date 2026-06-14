const fs = require("fs");
const path = require("path");
const { createDatabaseClient, ensureDatabaseExists, resolveProjectPath } = require("./dbCommon");

function loadSeedFiles(seedsDir) {
  return fs
    .readdirSync(seedsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => ({
      name: entry.name,
      filePath: path.join(seedsDir, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function runSeeds(client, seeds) {
  const results = [];

  for (const seed of seeds) {
    const seedModule = require(seed.filePath);

    if (typeof seedModule.seedAdminUser === "function") {
      const result = await seedModule.seedAdminUser(client);
      results.push({ name: seed.name, result });
      console.log(`Seed executada: ${seed.name}`);
    }
  }

  return results;
}

async function main() {
  const seedsDir = resolveProjectPath("database", "seeds");
  const seeds = loadSeedFiles(seedsDir);

  await ensureDatabaseExists();

  const client = createDatabaseClient();
  await client.connect();

  try {
    const results = await runSeeds(client, seeds);
    console.log(`${results.length} seed(s) executadas com sucesso.`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Falha ao executar seeds:", error.message);
    process.exit(1);
  });
}

module.exports = {
  loadSeedFiles,
  runSeeds,
};
