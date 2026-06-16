const jwt = require("jsonwebtoken");
const env = require("../config/env");
const deliveryRepository = require("../repositories/deliveryRepository");
const routePlanningRepository = require("../repositories/routePlanningRepository");
const resolveView = require("../utils/viewResolver");
const { PERMISSIONS, hasPermission, filterCardsForUser } = require("../config/permissions");

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
    titulo: "Manutencoes",
    icone: "MN",
    descricao: "Planeje manutencoes preventivas, corretivas e acompanhe alertas de vencimento.",
    href: "/manutencoes-veiculos",
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
    titulo: "Despesas de Veiculos",
    icone: "FT",
    descricao: "Controle despesas operacionais por veiculo e motorista.",
    href: "/despesas-veiculos",
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

function accessDeniedPage(_req, res) {
  res.status(403).sendFile(resolveView("acesso-negado.html"));
}

async function homeData(req, res) {
  const canViewDeliveries = hasPermission(req.user, PERMISSIONS.DELIVERIES_VIEW);
  const canViewRoutes = hasPermission(req.user, PERMISSIONS.ROUTES_VIEW);
  const [dashboard, routeDashboard] = await Promise.all([
    canViewDeliveries
      ? deliveryRepository.getDashboardSummaryForUser(req.user)
      : {
          total: 0,
          emTransito: 0,
          entregues: 0,
          pendentes: 0,
        },
    canViewRoutes
      ? routePlanningRepository.getDashboardSummaryForUser(req.user)
      : {
          total: 0,
          planejadas: 0,
          emAndamento: 0,
          concluidas: 0,
        },
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
    cards: filterCardsForUser(cards, req.user),
  });
}

module.exports = {
  entry,
  loginPage,
  registerPage,
  homePage,
  accessDeniedPage,
  homeData,
};
