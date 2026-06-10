const express = require("express");
const controller = require("../controllers/deliveryEventController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/api/entregas/:id/eventos",
  authMiddleware({ api: true }),
  controller.list,
);

module.exports = router;
