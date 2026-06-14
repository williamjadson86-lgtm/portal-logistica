const express = require("express");
const controller = require("../controllers/reportController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/relatorios", authMiddleware(), controller.page);
router.get("/api/relatorios/clientes", authMiddleware({ api: true }), controller.listByClient);
router.get(
  "/api/relatorios/clientes/export.csv",
  authMiddleware({ api: true }),
  controller.exportClientsCsv,
);
router.get(
  "/api/relatorios/clientes/export.xlsx",
  authMiddleware({ api: true }),
  controller.exportClientsXlsx,
);
router.get(
  "/api/relatorios/clientes/:id",
  authMiddleware({ api: true }),
  controller.showClientDetail,
);

module.exports = router;
