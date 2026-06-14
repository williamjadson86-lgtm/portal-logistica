const express = require("express");
const controller = require("../controllers/vehicleController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/veiculos", authMiddleware({ permission: PERMISSIONS.VEHICLES_VIEW }), controller.page);
router.get(
  "/api/veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_VIEW }),
  controller.list,
);
router.post(
  "/api/veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.create,
);
router.get(
  "/api/veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_VIEW }),
  controller.show,
);
router.patch(
  "/api/veiculos/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.updateStatus,
);
router.patch(
  "/api/veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.update,
);
router.delete(
  "/api/veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.remove,
);

module.exports = router;
