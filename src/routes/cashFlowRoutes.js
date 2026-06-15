const express = require("express");
const controller = require("../controllers/cashFlowController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/fluxo-caixa", authMiddleware({ permission: PERMISSIONS.FINANCE_VIEW }), controller.page);
router.get(
  "/api/fluxo-caixa",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.getCashFlow,
);
router.patch(
  "/api/fluxo-caixa/receber/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.markReceivableReceived,
);
router.patch(
  "/api/fluxo-caixa/pagar/financeiro/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.markPayablePaid,
);
router.patch(
  "/api/fluxo-caixa/pagar/frota/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_MANAGE }),
  controller.markFleetPayablePaid,
);
router.get(
  "/api/fluxo-caixa/export.csv",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.exportCashFlowCsv,
);
router.get(
  "/api/fluxo-caixa/export.xlsx",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.exportCashFlowXlsx,
);
router.get(
  "/api/fluxo-caixa/receber/export.csv",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.exportReceivablesCsv,
);
router.get(
  "/api/fluxo-caixa/receber/export.xlsx",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.exportReceivablesXlsx,
);
router.get(
  "/api/fluxo-caixa/pagar/export.csv",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.exportPayablesCsv,
);
router.get(
  "/api/fluxo-caixa/pagar/export.xlsx",
  authMiddleware({ api: true, permission: PERMISSIONS.FINANCE_VIEW }),
  controller.exportPayablesXlsx,
);

module.exports = router;
