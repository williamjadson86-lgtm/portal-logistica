const repository = require("../repositories/settingsRepository");
const resolveView = require("../utils/viewResolver");

function page(_req, res) {
  res.sendFile(resolveView("configuracoes.html"));
}

async function data(req, res) {
  const settings = await repository.findByUserId(req.user.id);

  res.json({
    usuario: req.user,
    modulo: {
      titulo: "Configuracoes",
      descricao: "Preferencias pessoais e configuracoes de notificacao do portal.",
    },
    resumo: [
      { rotulo: "Tema", valor: settings.tema },
      { rotulo: "Idioma", valor: settings.idioma },
      { rotulo: "E-mail", valor: settings.notificacoesEmail ? "Ativo" : "Desativado" },
      { rotulo: "Push", valor: settings.notificacoesPush ? "Ativo" : "Desativado" },
    ],
    itens: [
      {
        titulo: "Preferencias do portal",
        subtitulo: "Configuracao base do usuario autenticado",
        status: "ativo",
        meta: `Atualizado em ${new Date(settings.atualizadoEm).toLocaleDateString("pt-BR")}`,
        descricao: `Tema ${settings.tema}, idioma ${settings.idioma}, e-mail ${settings.notificacoesEmail ? "ligado" : "desligado"} e push ${settings.notificacoesPush ? "ligado" : "desligado"}.`,
      },
    ],
  });
}

module.exports = { page, data };
