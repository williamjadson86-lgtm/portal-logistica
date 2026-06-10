const express = require("express");
const controller = require("../controllers/vehicleController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/veiculos", authMiddleware(), controller.page);
router.get("/api/veiculos", authMiddleware({ api: true }), controller.list);
router.post("/api/veiculos", authMiddleware({ api: true }), controller.create);
router.get("/api/veiculos/:id", authMiddleware({ api: true }), controller.show);
router.patch(
  "/api/veiculos/:id/status",
  authMiddleware({ api: true }),
  controller.updateStatus,
);
router.patch("/api/veiculos/:id", authMiddleware({ api: true }), controller.update);
router.delete("/api/veiculos/:id", authMiddleware({ api: true }), controller.remove);

module.exports = router;
