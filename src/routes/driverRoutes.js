const express = require("express");
const controller = require("../controllers/driverController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/motoristas", authMiddleware(), controller.page);
router.get("/api/motoristas", authMiddleware({ api: true }), controller.list);
router.post("/api/motoristas", authMiddleware({ api: true }), controller.create);
router.get("/api/motoristas/:id", authMiddleware({ api: true }), controller.show);
router.patch(
  "/api/motoristas/:id/status",
  authMiddleware({ api: true }),
  controller.updateStatus,
);
router.patch("/api/motoristas/:id", authMiddleware({ api: true }), controller.update);
router.delete("/api/motoristas/:id", authMiddleware({ api: true }), controller.remove);

module.exports = router;
