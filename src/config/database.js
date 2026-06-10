const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (error) => {
  console.error("Erro inesperado no PostgreSQL:", error);
});

module.exports = {
  query(text, params) {
    return pool.query(text, params);
  },
  getClient() {
    return pool.connect();
  },
  close() {
    return pool.end();
  },
};
