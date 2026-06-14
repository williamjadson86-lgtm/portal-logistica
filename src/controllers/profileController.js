const repository = require("../repositories/profileRepository");
const resolveView = require("../utils/viewResolver");

function page(_req, res) {
  res.sendFile(resolveView("perfil.html"));
}

async function data(req, res) {
  const result = await repository.findByUserId(req.user);
  const profile = result.profile;

  res.json({
    usuario: req.user,
    modulo: {
      titulo: "Perfil",
      descricao: "Consulte seus dados cadastrais e a situacao operacional atual.",
    },
    resumo: [
      { rotulo: "Tipo de usuario", valor: profile.tipoUsuario },
      { rotulo: "Status", valor: profile.ativo ? "Ativo" : "Inativo" },
      { rotulo: "Matricula", valor: profile.matricula },
    ],
    destaques: [
      { rotulo: "E-mail", valor: profile.email },
      { rotulo: "Telefone", valor: profile.telefone },
      { rotulo: "CPF", valor: profile.cpf },
    ],
    itens: [
      {
        titulo: profile.nome,
        subtitulo: "Cadastro principal do colaborador",
        status: profile.ativo ? "Ativo" : "Inativo",
        meta: `Criado em ${new Date(profile.criadoEm).toLocaleDateString("pt-BR")}`,
        descricao: `Entregas: ${result.counters.entregas} | Documentos: ${result.counters.documentos} | Chamados abertos: ${result.counters.chamados_abertos} | Lancamentos: ${result.counters.lancamentos}`,
      },
    ],
  });
}

module.exports = { page, data };
