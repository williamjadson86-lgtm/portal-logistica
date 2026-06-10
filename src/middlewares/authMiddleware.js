const jwt = require("jsonwebtoken");
const env = require("../config/env");
const HttpError = require("../errors/HttpError");
const repository = require("../repositories/userRepository");

function extractToken(req) {
  const authorization = req.headers.authorization;

  if (authorization && authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return req.cookies[env.cookieName];
}

function authMiddleware(options = {}) {
  const { api = false } = options;

  return async function handleAuth(req, res, next) {
    const token = extractToken(req);

    if (!token) {
      if (api) {
        return next(new HttpError(401, "Autenticacao obrigatoria"));
      }

      return res.redirect("/login");
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await repository.findById(payload.sub);

      if (!user || !user.ativo) {
        throw new HttpError(401, "Sessao invalida");
      }

      req.user = user;
      return next();
    } catch (error) {
      if (api) {
        return next(new HttpError(401, "Sessao invalida"));
      }

      return res.redirect("/login");
    }
  };
}

module.exports = authMiddleware;
