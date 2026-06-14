const express = require("express");
const controller = require("../controllers/deliveryController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/entregas", authMiddleware({ permission: PERMISSIONS.DELIVERIES_VIEW }), controller.page);

router.get(
  "/api/entregas",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_VIEW }),
  controller.list,
);
router.post(
  "/api/entregas",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_MANAGE }),
  controller.create,
);
router.get(
  "/api/entregas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_VIEW }),
  controller.show,
);
router.post(
  "/api/entregas/:id/lancamento-financeiro",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_MANAGE }),
  controller.createFinancialEntry,
);
router.patch(
  "/api/entregas/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_MANAGE }),
  controller.updateStatus,
);
router.patch(
  "/api/entregas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_MANAGE }),
  controller.update,
);
router.delete(
  "/api/entregas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERIES_MANAGE }),
  controller.remove,
);

module.exports = router;
