const express = require("express");
const controller = require("../controllers/noticeController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/avisos", authMiddleware({ permission: PERMISSIONS.NOTICES_VIEW }), controller.page);
router.get(
  "/api/avisos",
  authMiddleware({ api: true, permission: PERMISSIONS.NOTICES_VIEW }),
  controller.data,
);

module.exports = router;
