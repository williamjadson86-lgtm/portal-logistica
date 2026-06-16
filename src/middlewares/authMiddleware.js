const jwt = require("jsonwebtoken");
const env = require("../config/env");
const HttpError = require("../errors/HttpError");
const repository = require("../repositories/userRepository");
const {
  hasPermission,
  listPermissionsForUser,
  normalizeUserRole,
} = require("../config/permissions");

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

function enrichUserContext(user) {
  const role = normalizeUserRole(user);

  return {
    ...user,
    tipoUsuario: role || user.tipoUsuario || null,
    perfil: role || user.tipoUsuario || null,
    role: role || user.tipoUsuario || null,
    empresaId: user.empresaId || user.empresa_id || null,
    empresa_id: user.empresaId || user.empresa_id || null,
    permissions: listPermissionsForUser({
      ...user,
      tipoUsuario: role || user.tipoUsuario || null,
    }),
  };
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

      const enrichedUser = enrichUserContext(user);

      if (!hasPermission(enrichedUser, permission)) {
        if (api) {
          return next(new HttpError(403, "Acesso negado para o perfil atual"));
        }

        return redirectForbidden(res, permission);
      }

      req.user = enrichedUser;
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
