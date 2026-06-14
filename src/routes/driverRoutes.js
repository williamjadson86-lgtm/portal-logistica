const express = require("express");
const controller = require("../controllers/driverController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/motoristas", authMiddleware({ permission: PERMISSIONS.DRIVERS_VIEW }), controller.page);
router.get(
  "/api/motoristas",
  authMiddleware({ api: true, permission: PERMISSIONS.DRIVERS_VIEW }),
  controller.list,
);
router.post(
  "/api/motoristas",
  authMiddleware({ api: true, permission: PERMISSIONS.DRIVERS_MANAGE }),
  controller.create,
);
router.get(
  "/api/motoristas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.DRIVERS_VIEW }),
  controller.show,
);
router.patch(
  "/api/motoristas/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.DRIVERS_MANAGE }),
  controller.updateStatus,
);
router.patch(
  "/api/motoristas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.DRIVERS_MANAGE }),
  controller.update,
);
router.delete(
  "/api/motoristas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.DRIVERS_MANAGE }),
  controller.remove,
);

module.exports = router;
