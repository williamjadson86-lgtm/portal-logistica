const jwt = require("jsonwebtoken");
const env = require("../config/env");
const deliveryRepository = require("../repositories/deliveryRepository");
const routePlanningRepository = require("../repositories/routePlanningRepository");
const resolveView = require("../utils/viewResolver");

const cards = [
  {
    titulo: "Perfil",
    icone: "PF",
    descricao: "Dados cadastrais e informacoes pessoais.",
    href: "/perfil",
  },
  {
    titulo: "Entregas",
    icone: "ET",
    descricao: "Acompanhe operacoes e historico de entregas.",
    href: "/entregas",
  },
  {
    titulo: "Rotas",
    icone: "RT",
    descricao: "Consulte itinerarios e janelas operacionais.",
    href: "/rotas",
  },
  {
    titulo: "Clientes",
    icone: "CL",
    descricao: "Mantenha a base comercial e contatos operacionais organizados.",
    href: "/clientes",
  },
  {
    titulo: "Motoristas",
    icone: "MT",
    descricao: "Gerencie o quadro operacional de condutores.",
    href: "/motoristas",
  },
  {
    titulo: "Veiculos",
    icone: "VH",
    descricao: "Controle a frota, disponibilidade e manutencao.",
    href: "/veiculos",
  },
  {
    titulo: "Comprovantes",
    icone: "CP",
    descricao: "Acesse comprovantes e protocolos.",
    href: "/comprovantes",
  },
  {
    titulo: "Financeiro",
    icone: "FN",
    descricao: "Visualize repasses e movimentacoes.",
    href: "/financeiro",
  },
  {
    titulo: "Relatorios",
    icone: "RL",
    descricao: "Acompanhe indicadores operacionais e financeiros por cliente.",
    href: "/relatorios",
  },
  {
    titulo: "Documentos",
    icone: "DC",
    descricao: "Gerencie anexos e documentos obrigatorios.",
    href: "/documentos",
  },
  {
    titulo: "Suporte",
    icone: "SP",
    descricao: "Solicite ajuda ao time de atendimento.",
    href: "/suporte",
  },
  {
    titulo: "Avisos",
    icone: "AV",
    descricao: "Leia comunicados e atualizacoes da operacao.",
    href: "/avisos",
  },
  {
    titulo: "Configuracoes",
    icone: "CF",
    descricao: "Ajuste preferencias do portal.",
    href: "/configuracoes",
  },
];

function entry(req, res) {
  const token = req.cookies[env.cookieName];

  if (!token) {
    return res.redirect("/login");
  }

  try {
    jwt.verify(token, env.jwtSecret);
    return res.redirect("/home");
  } catch (_error) {
    return res.redirect("/login");
  }
}

function loginPage(_req, res) {
  res.sendFile(resolveView("login.html"));
}

function registerPage(_req, res) {
  res.sendFile(resolveView("cadastro.html"));
}

function homePage(_req, res) {
  res.sendFile(resolveView("home.html"));
}

async function homeData(req, res) {
  const [dashboard, routeDashboard] = await Promise.all([
    deliveryRepository.getDashboardSummary(req.user.id),
    routePlanningRepository.getDashboardSummary(req.user.id),
  ]);

  res.json({
    usuario: req.user,
    dashboard: {
      totalEntregas: dashboard.total,
      entregasEmTransito: dashboard.emTransito,
      entregasEntregues: dashboard.entregues,
      entregasPendentes: dashboard.pendentes,
    },
    rotas: {
      rotasPlanejadas: routeDashboard.planejadas,
      rotasEmAndamento: routeDashboard.emAndamento,
      rotasConcluidas: routeDashboard.concluidas,
    },
    cards,
  });
}

module.exports = {
  entry,
  loginPage,
  registerPage,
  homePage,
  homeData,
};
