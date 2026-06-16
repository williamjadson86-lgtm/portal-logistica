function normalizeActor(actor) {
  if (!actor) {
    return {
      userId: null,
      empresaId: null,
      tipoUsuario: null,
      cpf: null,
    };
  }

  if (typeof actor === "string") {
    return {
      userId: actor,
      empresaId: null,
      tipoUsuario: null,
      cpf: null,
    };
  }

  return {
    userId: actor.id || actor.userId || null,
    empresaId: actor.empresaId || actor.empresa_id || null,
    tipoUsuario: actor.tipoUsuario || actor.perfil || actor.role || null,
    cpf: actor.cpf || null,
  };
}

function buildTenantCondition(options) {
  const {
    actor,
    tableAlias,
    startIndex = 1,
    empresaColumn = "empresa_id",
    userColumn = "usuario_id",
    includeLegacyFallback = true,
  } = options;
  const context = normalizeActor(actor);
  const aliasPrefix = tableAlias ? `${tableAlias}.` : "";
  const params = [];

  if (context.empresaId) {
    params.push(context.empresaId);
    const empresaIndex = startIndex;

    if (includeLegacyFallback && context.userId) {
      params.push(context.userId);
      const userIndex = startIndex + 1;

      return {
        params,
        nextIndex: startIndex + params.length,
        condition: `(${aliasPrefix}${empresaColumn} = $${empresaIndex} OR (${aliasPrefix}${empresaColumn} IS NULL AND ${aliasPrefix}${userColumn} = $${userIndex}))`,
      };
    }

    return {
      params,
      nextIndex: startIndex + params.length,
      condition: `${aliasPrefix}${empresaColumn} = $${empresaIndex}`,
    };
  }

  params.push(context.userId);
  return {
    params,
    nextIndex: startIndex + 1,
    condition: `${aliasPrefix}${userColumn} = $${startIndex}`,
  };
}

module.exports = {
  normalizeActor,
  buildTenantCondition,
};
