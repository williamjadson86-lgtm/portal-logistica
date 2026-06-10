const repository = require("../repositories/documentRepository");
const resolveView = require("../utils/viewResolver");

function page(_req, res) {
  res.sendFile(resolveView("documentos.html"));
}

async function data(req, res) {
  const documents = await repository.listByUserId(req.user.id);

  res.json({
    usuario: req.user,
    modulo: {
      titulo: "Documentos",
      descricao: "Gerencie documentos obrigatorios e acompanhe a validade dos registros.",
    },
    resumo: [
      { rotulo: "Total", valor: documents.length },
      {
        rotulo: "Aprovados",
        valor: documents.filter((document) => document.status === "aprovado").length,
      },
      {
        rotulo: "Vencidos",
        valor: documents.filter((document) => document.status === "vencido").length,
      },
    ],
    itens: documents.map((document) => ({
      titulo: document.nome,
      subtitulo: document.tipo,
      status: document.status,
      meta: document.validadeEm
        ? `Validade ${document.validadeEm}`
        : "Sem validade informada",
      descricao: "Documento registrado para acompanhamento do portal.",
    })),
  });
}

module.exports = { page, data };
