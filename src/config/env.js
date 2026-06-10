const dotenv = require("dotenv");

dotenv.config();

function parseDurationToMs(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = value.trim();
  const directNumber = Number(normalized);
  if (Number.isFinite(directNumber) && directNumber > 0) {
    return directNumber * 1000;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/portal_logistica",
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret: process.env.JWT_SECRET || "portal-logistica-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  jwtExpiresInMs: parseDurationToMs(process.env.JWT_EXPIRES_IN || "8h", 8 * 60 * 60 * 1000),
  cookieName: process.env.COOKIE_NAME || "portal_logistica_token",
  nodeEnv: process.env.NODE_ENV || "development",
};
