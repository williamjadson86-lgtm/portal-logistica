const PERIODS = ["hoje", "7d", "30d", "custom"];

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date) {
  return toDateOnly(date).toISOString().slice(0, 10);
}

function shiftDays(date, amount) {
  const copy = toDateOnly(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function validateDashboardQuery(query, referenceDate = new Date()) {
  const periodo = PERIODS.includes(query.periodo) ? query.periodo : "7d";
  const today = toDateOnly(referenceDate);
  let dataInicio;
  let dataFim;
  const errors = [];

  if (periodo === "hoje") {
    dataInicio = today;
    dataFim = today;
  } else if (periodo === "7d") {
    dataInicio = shiftDays(today, -6);
    dataFim = today;
  } else if (periodo === "30d") {
    dataInicio = shiftDays(today, -29);
    dataFim = today;
  } else {
    if (!isValidDate(query.dataInicio)) {
      errors.push("dataInicio deve estar no formato YYYY-MM-DD");
    }

    if (!isValidDate(query.dataFim)) {
      errors.push("dataFim deve estar no formato YYYY-MM-DD");
    }

    if (errors.length === 0) {
      dataInicio = new Date(`${query.dataInicio}T00:00:00Z`);
      dataFim = new Date(`${query.dataFim}T00:00:00Z`);

      if (dataInicio > dataFim) {
        errors.push("dataInicio nao pode ser maior que dataFim");
      }
    }
  }

  return {
    errors,
    data: errors.length
      ? {}
      : {
          periodo,
          dataInicio: formatDate(dataInicio),
          dataFim: formatDate(dataFim),
          hoje: formatDate(today),
        },
  };
}

module.exports = {
  PERIODS,
  validateDashboardQuery,
};
