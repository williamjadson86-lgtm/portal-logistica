const express = require("express");
const controller = require("../controllers/financeController");
const fleetCostController = require("../controllers/fleetCostController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/financeiro", authMiddleware({ permission: PERMISSIONS.FINANCE_VIEW }), controller.page);
router.get(
  "/api/financeiro",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.list,
);
router.get(
  "/api/financeiro/despesas-veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  fleetCostController.list,
);
router.get(
  "/api/financeiro/despesas-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  fleetCostController.show,
);
router.get(
  "/api/financeiro/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.show,
);
router.post(
  "/api/financeiro",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.create,
);
router.post(
  "/api/financeiro/despesas-veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  fleetCostController.create,
);
router.patch(
  "/api/financeiro/despesas-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  fleetCostController.update,
);
router.patch(
  "/api/financeiro/despesas-veiculos/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  fleetCostController.updateStatus,
);
router.patch(
  "/api/financeiro/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.update,
);
router.patch(
  "/api/financeiro/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.updateStatus,
);
router.delete(
  "/api/financeiro/despesas-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  fleetCostController.remove,
);
router.delete(
  "/api/financeiro/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.remove,
);

module.exports = router;
