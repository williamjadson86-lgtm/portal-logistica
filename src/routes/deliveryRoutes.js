const express = require("express");
const controller = require("../controllers/deliveryController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/entregas", authMiddleware(), controller.page);

router.get("/api/entregas", authMiddleware({ api: true }), controller.list);
router.post("/api/entregas", authMiddleware({ api: true }), controller.create);
router.get("/api/entregas/:id", authMiddleware({ api: true }), controller.show);
router.post(
  "/api/entregas/:id/lancamento-financeiro",
  authMiddleware({ api: true }),
  controller.createFinancialEntry,
);
router.patch(
  "/api/entregas/:id/status",
  authMiddleware({ api: true }),
  controller.updateStatus,
);
router.patch("/api/entregas/:id", authMiddleware({ api: true }), controller.update);
router.delete("/api/entregas/:id", authMiddleware({ api: true }), controller.remove);

module.exports = router;
