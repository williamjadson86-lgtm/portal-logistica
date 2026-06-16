const TIMEZONES = ["America/Sao_Paulo", "UTC"];
const CURRENCIES = ["BRL", "USD", "EUR"];
const DATE_FORMATS = ["DD/MM/YYYY", "YYYY-MM-DD"];
const DASHBOARD_PERIODS = ["hoje", "7d", "30d", "custom"];

function parseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateSettingsUpdate(input) {
  const errors = [];
  const data = {};

  if (Object.hasOwn(input, "timezone")) {
    const timezone = parseText(input.timezone);
    if (!TIMEZONES.includes(timezone)) {
      errors.push("timezone invalido");
    } else {
      data.timezone = timezone;
    }
  }

  if (Object.hasOwn(input, "moeda")) {
    const moeda = parseText(input.moeda).toUpperCase();
    if (!CURRENCIES.includes(moeda)) {
      errors.push("moeda invalida");
    } else {
      data.moeda = moeda;
    }
  }

  if (Object.hasOwn(input, "formatoData")) {
    const formatoData = parseText(input.formatoData);
    if (!DATE_FORMATS.includes(formatoData)) {
      errors.push("formatoData invalido");
    } else {
      data.formatoData = formatoData;
    }
  }

  if (Object.hasOwn(input, "dashboardPeriodoPadrao")) {
    const dashboardPeriodoPadrao = parseText(input.dashboardPeriodoPadrao);
    if (!DASHBOARD_PERIODS.includes(dashboardPeriodoPadrao)) {
      errors.push("dashboardPeriodoPadrao invalido");
    } else {
      data.dashboardPeriodoPadrao = dashboardPeriodoPadrao;
    }
  }

  if (Object.hasOwn(input, "dashboardExibirFinanceiro")) {
    data.dashboardExibirFinanceiro = Boolean(input.dashboardExibirFinanceiro);
  }

  if (Object.keys(data).length === 0) {
    errors.push("informe ao menos um campo de configuracao");
  }

  return { errors, data };
}

module.exports = {
  TIMEZONES,
  CURRENCIES,
  DATE_FORMATS,
  DASHBOARD_PERIODS,
  validateSettingsUpdate,
};
