const express = require("express");
const multer = require("multer");
const controller = require("../controllers/proofController");
const authMiddleware = require("../middlewares/authMiddleware");
const { proofUpload } = require("../config/upload");
const HttpError = require("../errors/HttpError");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

function uploadErrorHandler(error, _req, _res, next) {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    next(new HttpError(400, "Arquivo excede o tamanho maximo permitido"));
    return;
  }

  next(error);
}

router.get("/comprovantes", authMiddleware({ permission: PERMISSIONS.PROOFS_VIEW }), controller.page);
router.get(
  "/api/comprovantes",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_VIEW }),
  controller.list,
);
router.get(
  "/api/comprovantes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_VIEW }),
  controller.show,
);
router.get(
  "/api/comprovantes/:id/arquivo",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_VIEW }),
  controller.streamFile,
);
router.get(
  "/api/entregas/:entregaId/comprovantes",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_VIEW }),
  controller.listByDelivery,
);
router.post(
  "/api/entregas/:entregaId/comprovantes",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_UPLOAD }),
  proofUpload.single("arquivo"),
  uploadErrorHandler,
  controller.create,
);
router.patch(
  "/api/comprovantes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_MANAGE }),
  controller.update,
);
router.delete(
  "/api/comprovantes/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.PROOFS_MANAGE }),
  controller.remove,
);

module.exports = router;
