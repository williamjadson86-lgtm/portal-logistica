const express = require("express");
const controller = require("../controllers/settingsController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/configuracoes",
  authMiddleware({ permission: PERMISSIONS.SETTINGS_VIEW }),
  controller.page,
);
router.get(
  "/api/configuracoes",
  authMiddleware({ api: true, permission: PERMISSIONS.SETTINGS_VIEW }),
  controller.data,
);
router.patch(
  "/api/configuracoes",
  authMiddleware({ api: true, permission: PERMISSIONS.SETTINGS_VIEW }),
  controller.update,
);
router.get(
  "/api/permissoes",
  authMiddleware({ api: true, permission: PERMISSIONS.PERMISSIONS_VIEW }),
  controller.permissions,
);

module.exports = router;
