const express = require("express");
const controller = require("../controllers/vehicleMaintenanceController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/manutencoes-veiculos",
  authMiddleware({ permission: PERMISSIONS.VEHICLES_VIEW }),
  controller.page,
);
router.get(
  "/api/manutencoes-veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_VIEW }),
  controller.list,
);
router.get(
  "/api/manutencoes-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_VIEW }),
  controller.show,
);
router.post(
  "/api/manutencoes-veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.create,
);
router.patch(
  "/api/manutencoes-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.update,
);
router.delete(
  "/api/manutencoes-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.VEHICLES_MANAGE }),
  controller.remove,
);

module.exports = router;
