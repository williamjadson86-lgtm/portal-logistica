const repository = require("../repositories/dashboardRepository");
const HttpError = require("../errors/HttpError");
const { validateDashboardQuery } = require("../validations/dashboardValidation");

async function getDashboard(req, res) {
  const { errors, data } = validateDashboardQuery(req.query);

  if (errors.length > 0) {
    throw new HttpError(400, "Dados invalidos", errors);
  }

  const dashboard = await repository.getOperationalDashboard(req.user, data);
  res.json(dashboard);
}

module.exports = {
  getDashboard,
};
