const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const portalRoutes = require("./routes/portalRoutes");
const profileRoutes = require("./routes/profileRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const deliveryEventRoutes = require("./routes/deliveryEventRoutes");
const routePlanningRoutes = require("./routes/routePlanningRoutes");
const clientRoutes = require("./routes/clientRoutes");
const driverRoutes = require("./routes/driverRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const vehicleMaintenanceRoutes = require("./routes/vehicleMaintenanceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const proofRoutes = require("./routes/proofRoutes");
const financeRoutes = require("./routes/financeRoutes");
const cashFlowRoutes = require("./routes/cashFlowRoutes");
const fleetCostRoutes = require("./routes/fleetCostRoutes");
const reportRoutes = require("./routes/reportRoutes");
const documentRoutes = require("./routes/documentRoutes");
const supportRoutes = require("./routes/supportRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const errorHandler = require("./middlewares/errorHandler");
const HttpError = require("./errors/HttpError");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", sistema: "Portal Logistica" });
});

app.use("/", portalRoutes);
app.use("/", profileRoutes);
app.use("/", deliveryRoutes);
app.use("/", deliveryEventRoutes);
app.use("/", routePlanningRoutes);
app.use("/", clientRoutes);
app.use("/", driverRoutes);
app.use("/", vehicleRoutes);
app.use("/", vehicleMaintenanceRoutes);
app.use("/", dashboardRoutes);
app.use("/", proofRoutes);
app.use("/", financeRoutes);
app.use("/", cashFlowRoutes);
app.use("/", fleetCostRoutes);
app.use("/", reportRoutes);
app.use("/", documentRoutes);
app.use("/", supportRoutes);
app.use("/", noticeRoutes);
app.use("/", settingsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use((_req, _res, next) => {
  next(new HttpError(404, "Rota nao encontrada"));
});

app.use(errorHandler);

module.exports = app;
