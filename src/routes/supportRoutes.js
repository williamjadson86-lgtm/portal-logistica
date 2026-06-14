const express = require("express");
const controller = require("../controllers/supportController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/suporte", authMiddleware({ permission: PERMISSIONS.SUPPORT_VIEW }), controller.page);
router.get(
  "/api/suporte",
  authMiddleware({ api: true, permission: PERMISSIONS.SUPPORT_VIEW }),
  controller.data,
);

module.exports = router;
