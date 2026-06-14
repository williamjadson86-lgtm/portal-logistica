const repository = require("../repositories/supportRepository");
const resolveView = require("../utils/viewResolver");

function page(_req, res) {
  res.sendFile(resolveView("suporte.html"));
}

async function data(req, res) {
  const tickets = await repository.listByUserId(req.user);

  res.json({
    usuario: req.user,
    modulo: {
      titulo: "Suporte",
      descricao: "Acompanhe chamados de atendimento e demandas operacionais.",
    },
    resumo: [
      { rotulo: "Chamados", valor: tickets.length },
      {
        rotulo: "Abertos",
        valor: tickets.filter((ticket) => ticket.status === "aberto").length,
      },
      {
        rotulo: "Resolvidos",
        valor: tickets.filter((ticket) => ticket.status === "resolvido").length,
      },
    ],
    itens: tickets.map((ticket) => ({
      titulo: ticket.assunto,
      subtitulo: `${ticket.categoria} | prioridade ${ticket.prioridade}`,
      status: ticket.status,
      meta: `Atualizado em ${new Date(ticket.atualizadoEm).toLocaleDateString("pt-BR")}`,
      descricao: ticket.mensagem,
    })),
  });
}

module.exports = { page, data };
