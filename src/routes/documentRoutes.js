const express = require("express");
const controller = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/documentos",
  authMiddleware({ permission: PERMISSIONS.DOCUMENTS_VIEW }),
  controller.page,
);
router.get(
  "/api/documentos",
  authMiddleware({ api: true, permission: PERMISSIONS.DOCUMENTS_VIEW }),
  controller.data,
);

module.exports = router;
