const express = require("express");
const controller = require("../controllers/companyController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get(
  "/api/empresas",
  authMiddleware({ api: true, permission: PERMISSIONS.COMPANY_VIEW }),
  controller.list,
);
router.get(
  "/api/empresas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.COMPANY_VIEW }),
  controller.show,
);
router.post(
  "/api/empresas",
  authMiddleware({ api: true, permission: PERMISSIONS.COMPANY_MANAGE }),
  controller.create,
);
router.patch(
  "/api/empresas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.COMPANY_MANAGE }),
  controller.update,
);
router.delete(
  "/api/empresas/:id",
  authMiddleware({ api: true, permission: PERMISSIONS.COMPANY_MANAGE }),
  controller.remove,
);

module.exports = router;
