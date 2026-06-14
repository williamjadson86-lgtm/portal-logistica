const express = require("express");
const controller = require("../controllers/dashboardController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/api/dashboard",
  authMiddleware({ api: true, permission: PERMISSIONS.DASHBOARD_VIEW }),
  controller.getDashboard,
);

module.exports = router;
