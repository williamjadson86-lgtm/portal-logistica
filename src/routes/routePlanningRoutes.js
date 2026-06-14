const express = require("express");
const controller = require("../controllers/routePlanningController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/rotas", authMiddleware({ permission: PERMISSIONS.ROUTES_VIEW }), controller.page);

router.get("/api/rotas", authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_VIEW }), controller.list);
router.post(
  "/api/rotas",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.create,
);
router.get(
  "/api/rotas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_VIEW }),
  controller.show,
);
router.patch(
  "/api/rotas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.update,
);
router.delete(
  "/api/rotas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.remove,
);
router.post(
  "/api/rotas/:id/entregas",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.addDeliveries,
);
router.delete(
  "/api/rotas/:id/entregas/:entregaId",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.removeDelivery,
);
router.patch(
  "/api/rotas/:id/iniciar",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.start,
);
router.patch(
  "/api/rotas/:id/concluir",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.complete,
);
router.patch(
  "/api/rotas/:id/cancelar",
  authMiddleware({ api: true, permission: PERMISSIONS.ROUTES_MANAGE }),
  controller.cancel,
);

module.exports = router;
