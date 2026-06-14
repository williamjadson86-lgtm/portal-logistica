const express = require("express");
const controller = require("../controllers/clientController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/clientes", authMiddleware({ permission: PERMISSIONS.CLIENTS_VIEW }), controller.page);
router.get(
  "/api/clientes",
  authMiddleware({ api: true, permission: PERMISSIONS.CLIENTS_VIEW }),
  controller.list,
);
router.post(
  "/api/clientes",
  authMiddleware({ api: true, permission: PERMISSIONS.CLIENTS_MANAGE }),
  controller.create,
);
router.get(
  "/api/clientes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.CLIENTS_VIEW }),
  controller.show,
);
router.patch(
  "/api/clientes/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.CLIENTS_MANAGE }),
  controller.updateStatus,
);
router.patch(
  "/api/clientes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.CLIENTS_MANAGE }),
  controller.update,
);
router.delete(
  "/api/clientes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.CLIENTS_MANAGE }),
  controller.remove,
);

module.exports = router;
