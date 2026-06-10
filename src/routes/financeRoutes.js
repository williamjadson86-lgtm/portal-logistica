const express = require("express");
const controller = require("../controllers/financeController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/financeiro", authMiddleware(), controller.page);
router.get("/api/financeiro", authMiddleware({ api: true }), controller.list);
router.get("/api/financeiro/:id", authMiddleware({ api: true }), controller.show);
router.post("/api/financeiro", authMiddleware({ api: true }), controller.create);
router.patch("/api/financeiro/:id", authMiddleware({ api: true }), controller.update);
router.patch(
  "/api/financeiro/:id/status",
  authMiddleware({ api: true }),
  controller.updateStatus,
);
router.delete("/api/financeiro/:id", authMiddleware({ api: true }), controller.remove);

module.exports = router;
