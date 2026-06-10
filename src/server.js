const app = require("./app");
const env = require("./config/env");
const database = require("./config/database");

const server = app.listen(env.port, () => {
  console.log(`Portal Logistica disponivel em http://localhost:${env.port}`);
});

function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor...`);
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
