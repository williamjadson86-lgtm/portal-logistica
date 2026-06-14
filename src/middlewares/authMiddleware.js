const jwt = require("jsonwebtoken");
const env = require("../config/env");
const HttpError = require("../errors/HttpError");
const repository = require("../repositories/userRepository");
const { hasPermission } = require("../config/permissions");

function extractToken(req) {
  const authorization = req.headers.authorization;

  if (authorization && authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return req.cookies[env.cookieName];
}

function redirectForbidden(res, permission) {
  const query = permission
    ? `?motivo=${encodeURIComponent(permission)}`
    : "";

  return res.redirect(`/acesso-negado${query}`);
}

function authMiddleware(options = {}) {
  const { api = false, permission = null } = options;

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

      if (!hasPermission(user, permission)) {
        if (api) {
          return next(new HttpError(403, "Acesso negado para o perfil atual"));
        }

        return redirectForbidden(res, permission);
      }

      req.user = user;
      return next();
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) {
        return next(error);
      }

      if (api) {
        return next(new HttpError(401, "Sessao invalida"));
      }

      return res.redirect("/login");
    }
  };
}

module.exports = authMiddleware;
