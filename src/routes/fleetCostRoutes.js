const express = require("express");
const controller = require("../controllers/fleetCostController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/despesas-veiculos",
  authMiddleware({ permission: PERMISSIONS.FLEET_COSTS_VIEW }),
  controller.page,
);
router.get(
  "/custos-frota",
  authMiddleware({ permission: PERMISSIONS.FLEET_COSTS_VIEW }),
  controller.page,
);
router.get(
  "/api/despesas-veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_VIEW }),
  controller.list,
);
router.get(
  "/api/custos-frota",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_VIEW }),
  controller.list,
);
router.get(
  "/api/despesas-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_VIEW }),
  controller.show,
);
router.get(
  "/api/custos-frota/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_VIEW }),
  controller.show,
);
router.post(
  "/api/despesas-veiculos",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.create,
);
router.post(
  "/api/custos-frota",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.create,
);
router.patch(
  "/api/despesas-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.update,
);
router.patch(
  "/api/despesas-veiculos/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.updateStatus,
);
router.patch(
  "/api/custos-frota/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.update,
);
router.delete(
  "/api/despesas-veiculos/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.remove,
);
router.delete(
  "/api/custos-frota/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.FLEET_COSTS_MANAGE }),
  controller.remove,
);

module.exports = router;
