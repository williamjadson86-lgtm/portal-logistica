const path = require("path");
const fs = require("fs");
const repository = require("../repositories/proofRepository");
const eventRepository = require("../repositories/deliveryEventRepository");
const HttpError = require("../errors/HttpError");
const resolveView = require("../utils/viewResolver");
const {
  isValidUuid,
  validateProofCreate,
  validateProofUpdate,
} = require("../validations/proofValidation");

function page(_req, res) {
  res.sendFile(resolveView("comprovantes.html"));
}

function ensureValidUuid(value, label) {
  if (!isValidUuid(value)) {
    throw new HttpError(400, `Identificador de ${label} invalido`);
  }
}

async function list(req, res) {
  const entregaId = req.query.entregaId;

  if (entregaId) {
    ensureValidUuid(entregaId, "entrega");
  }

  const [comprovantes, entregas] = await Promise.all([
    repository.listByUserId(req.user.id, { entregaId, ativo: true }),
    repository.listDeliveriesForProofs(req.user.id),
  ]);

  res.json({
    resumo: {
      total: comprovantes.length,
      fotos: comprovantes.filter((item) => item.tipo === "foto").length,
      pdfs: comprovantes.filter((item) => item.tipo === "pdf").length,
      observacoes: comprovantes.filter((item) => item.tipo === "observacao").length,
    },
    comprovantes,
    entregas,
  });
}

async function show(req, res) {
  ensureValidUuid(req.params.id, "comprovante");
  const comprovante = await repository.findById(req.user.id, req.params.id);

  if (!comprovante) {
    throw new HttpError(404, "Comprovante nao encontrado");
  }

  res.json({ comprovante });
}

async function listByDelivery(req, res) {
  ensureValidUuid(req.params.entregaId, "entrega");
  const comprovantes = await repository.listByUserId(req.user.id, {
    entregaId: req.params.entregaId,
  });

  res.json({ comprovantes });
}

async function create(req, res) {
  try {
    ensureValidUuid(req.params.entregaId, "entrega");
    const { errors, data } = validateProofCreate(req.body, req.file);

    if (errors.length > 0) {
      throw new HttpError(400, "Dados invalidos", errors);
    }

    const comprovante = await repository.create(req.user.id, req.params.entregaId, {
      ...data,
      arquivoNome: req.file ? req.file.originalname : null,
      arquivoCaminho: req.file ? req.file.path : null,
      mimeType: req.file ? req.file.mimetype : null,
      tamanhoBytes: req.file ? req.file.size : null,
    });
    await eventRepository.appendEvent({
      entregaId: comprovante.entregaId,
      usuarioId: req.user?.id || null,
      tipoEvento: "comprovante_enviado",
      descricao: `Comprovante ${comprovante.tipo} enviado para a entrega ${comprovante.codigoEntrega}`,
      dados: {
        comprovanteId: comprovante.id,
        tipo: comprovante.tipo,
        arquivoNome: comprovante.arquivoNome,
        ativo: comprovante.ativo,
      },
    });

    res.status(201).json({
      mensagem: "Comprovante registrado com sucesso",
      comprovante,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
    }

    throw error;
  }
}

async function update(req, res) {
  ensureValidUuid(req.params.id, "comprovante");
  const { errors, data } = validateProofUpdate(req.body);

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const comprovante = await repository.updateById(req.user.id, req.params.id, data);

  if (!comprovante) {
    throw new HttpError(404, "Comprovante nao encontrado");
  }

  res.json({
    mensagem: "Comprovante atualizado com sucesso",
    comprovante,
  });
}

async function remove(req, res) {
  ensureValidUuid(req.params.id, "comprovante");
  const proof = await repository.findById(req.user.id, req.params.id);
  if (!proof) {
    throw new HttpError(404, "Comprovante nao encontrado");
  }

  const comprovante = await repository.deactivateById(req.user.id, req.params.id);

  if (!comprovante) {
    throw new HttpError(404, "Comprovante nao encontrado");
  }

  await eventRepository.appendEvent({
    entregaId: proof.entregaId,
    usuarioId: req.user?.id || null,
    tipoEvento: "comprovante_inativado",
    descricao: `Comprovante ${proof.tipo} inativado na entrega ${proof.codigoEntrega}`,
    dados: {
      comprovanteId: proof.id,
      tipo: proof.tipo,
      arquivoNome: proof.arquivoNome,
    },
  });

  res.json({ mensagem: "Comprovante inativado com sucesso" });
}

async function streamFile(req, res) {
  ensureValidUuid(req.params.id, "comprovante");
  const comprovante = await repository.findById(req.user.id, req.params.id);

  if (!comprovante || !comprovante.ativo || !comprovante.arquivoCaminho) {
    throw new HttpError(404, "Arquivo de comprovante nao encontrado");
  }

  res.setHeader("Content-Type", comprovante.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${path.basename(comprovante.arquivoNome || "comprovante")}"`,
  );
  res.sendFile(path.resolve(comprovante.arquivoCaminho));
}

module.exports = {
  page,
  list,
  show,
  listByDelivery,
  create,
  update,
  remove,
  streamFile,
};
