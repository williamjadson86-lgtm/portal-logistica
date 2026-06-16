const express = require("express");
const controller = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/api/usuarios",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_VIEW }),
  controller.list,
);
router.get(
  "/api/usuarios/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_VIEW }),
  controller.show,
);
router.post(
  "/api/usuarios",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_MANAGE }),
  controller.create,
);
router.patch(
  "/api/usuarios/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_MANAGE }),
  controller.update,
);
router.patch(
  "/api/usuarios/:id/status",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_MANAGE }),
  controller.updateStatus,
);
router.patch(
  "/api/usuarios/:id/perfil",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_MANAGE }),
  controller.updateRole,
);
router.patch(
  "/api/usuarios/:id/reset-password",
  authMiddleware({ api: true, permission: PERMISSIONS.USERS_MANAGE }),
  controller.resetPassword,
);

module.exports = router;
