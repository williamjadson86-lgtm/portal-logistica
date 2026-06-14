const express = require("express");
const controller = require("../controllers/reportController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/relatorios", authMiddleware({ permission: PERMISSIONS.REPORTS_VIEW }), controller.page);
router.get(
  "/api/relatorios/clientes",
  authMiddleware({ api: true, permission: PERMISSIONS.REPORTS_VIEW }),
  controller.listByClient,
);
router.get(
  "/api/relatorios/clientes/export.csv",
  authMiddleware({ api: true, permission: PERMISSIONS.REPORTS_VIEW }),
  controller.exportClientsCsv,
);
router.get(
  "/api/relatorios/clientes/export.xlsx",
  authMiddleware({ api: true, permission: PERMISSIONS.REPORTS_VIEW }),
  controller.exportClientsXlsx,
);
router.get(
  "/api/relatorios/clientes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.REPORTS_VIEW }),
  controller.showClientDetail,
);

module.exports = router;
