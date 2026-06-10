const express = require("express");
const controller = require("../controllers/routePlanningController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/rotas", authMiddleware(), controller.page);

router.get("/api/rotas", authMiddleware({ api: true }), controller.list);
router.post("/api/rotas", authMiddleware({ api: true }), controller.create);
router.get("/api/rotas/:id", authMiddleware({ api: true }), controller.show);
router.patch("/api/rotas/:id", authMiddleware({ api: true }), controller.update);
router.delete("/api/rotas/:id", authMiddleware({ api: true }), controller.remove);
router.post(
  "/api/rotas/:id/entregas",
  authMiddleware({ api: true }),
  controller.addDeliveries,
);
router.delete(
  "/api/rotas/:id/entregas/:entregaId",
  authMiddleware({ api: true }),
  controller.removeDelivery,
);
router.patch("/api/rotas/:id/iniciar", authMiddleware({ api: true }), controller.start);
router.patch(
  "/api/rotas/:id/concluir",
  authMiddleware({ api: true }),
  controller.complete,
);
router.patch("/api/rotas/:id/cancelar", authMiddleware({ api: true }), controller.cancel);

module.exports = router;
