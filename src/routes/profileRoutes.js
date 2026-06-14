const express = require("express");
const controller = require("../controllers/profileController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/perfil", authMiddleware({ permission: PERMISSIONS.PROFILE_VIEW }), controller.page);
router.get(
  "/api/perfil",
  authMiddleware({ api: true, permission: PERMISSIONS.PROFILE_VIEW }),
  controller.data,
);

module.exports = router;
