const express = require("express");
const controller = require("../controllers/clientController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/clientes", authMiddleware(), controller.page);
router.get("/api/clientes", authMiddleware({ api: true }), controller.list);
router.post("/api/clientes", authMiddleware({ api: true }), controller.create);
router.get("/api/clientes/:id", authMiddleware({ api: true }), controller.show);
router.patch("/api/clientes/:id/status", authMiddleware({ api: true }), controller.updateStatus);
router.patch("/api/clientes/:id", authMiddleware({ api: true }), controller.update);
router.delete("/api/clientes/:id", authMiddleware({ api: true }), controller.remove);

module.exports = router;
