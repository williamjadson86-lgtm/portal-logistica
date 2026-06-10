const repository = require("../repositories/noticeRepository");
const resolveView = require("../utils/viewResolver");

function page(_req, res) {
  res.sendFile(resolveView("avisos.html"));
}

async function data(req, res) {
  const notices = await repository.listActive();

  res.json({
    usuario: req.user,
    modulo: {
      titulo: "Avisos",
      descricao: "Mural interno com comunicados importantes da operacao.",
    },
    resumo: [
      { rotulo: "Avisos ativos", valor: notices.length },
      {
        rotulo: "Urgentes",
        valor: notices.filter((notice) => notice.prioridade === "urgente").length,
      },
      {
        rotulo: "Importantes",
        valor: notices.filter((notice) => notice.prioridade === "importante").length,
      },
    ],
    itens: notices.map((notice) => ({
      titulo: notice.titulo,
      subtitulo: `Publicado em ${new Date(notice.publicadoEm).toLocaleDateString("pt-BR")}`,
      status: notice.prioridade,
      meta: "Comunicado corporativo",
      descricao: notice.conteudo,
    })),
  });
}

module.exports = { page, data };
