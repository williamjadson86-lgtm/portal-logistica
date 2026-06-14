const express = require("express");
const controller = require("../controllers/deliveryEventController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/api/entregas/:id/eventos",
  authMiddleware({ api: true, permission: PERMISSIONS.DELIVERY_EVENTS_VIEW }),
  controller.list,
);

module.exports = router;
