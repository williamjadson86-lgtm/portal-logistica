function errorHandler(error, _req, res, _next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ erro: "JSON invalido" });
  }

  if (error.code === "23505") {
    if (error.constraint === "entregas_codigo_key") {
      return res.status(409).json({ erro: "Codigo de entrega ja cadastrado" });
    }

    if (error.constraint === "motoristas_usuario_id_cpf_key") {
      return res.status(409).json({ erro: "CPF de motorista ja cadastrado" });
    }

    if (error.constraint === "motoristas_usuario_id_cnh_key") {
      return res.status(409).json({ erro: "CNH de motorista ja cadastrada" });
    }

    if (error.constraint === "veiculos_usuario_id_placa_key") {
      return res.status(409).json({ erro: "Placa de veiculo ja cadastrada" });
    }

    if (error.constraint === "clientes_usuario_id_documento_key") {
      return res.status(409).json({ erro: "Documento de cliente ja cadastrado" });
    }

    if (error.constraint === "clientes_usuario_id_email_key") {
      return res.status(409).json({ erro: "E-mail de cliente ja cadastrado" });
    }

    if (error.constraint === "idx_rotas_codigo_unique") {
      return res.status(409).json({ erro: "Codigo de rota ja cadastrado" });
    }

    if (error.constraint === "idx_financeiro_entrega_ativa_unique") {
      return res
        .status(409)
        .json({ erro: "Ja existe lancamento financeiro ativo para esta entrega" });
    }

    if (error.constraint === "usuarios_email_key") {
      return res.status(409).json({ erro: "E-mail ja cadastrado" });
    }

    if (error.constraint === "usuarios_matricula_key") {
      return res.status(409).json({ erro: "Matricula ja cadastrada" });
    }

    return res.status(409).json({ erro: "Registro duplicado" });
  }

  const status = error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json({
    erro: error.message || "Erro interno do servidor",
    ...(error.details ? { detalhes: error.details } : {}),
  });
}

module.exports = errorHandler;
