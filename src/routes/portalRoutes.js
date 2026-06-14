const express = require("express");
const controller = require("../controllers/portalController");
const authMiddleware = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

router.get("/", controller.entry);
router.get("/login", controller.loginPage);
router.get("/cadastro", controller.registerPage);
router.get("/home", authMiddleware({ permission: PERMISSIONS.HOME_VIEW }), controller.homePage);
router.get("/acesso-negado", authMiddleware(), controller.accessDeniedPage);
router.get(
  "/api/portal/home",
  authMiddleware({ api: true, permission: PERMISSIONS.HOME_VIEW }),
  controller.homeData,
);
router.get(
  "/api/portal/cards",
  authMiddleware({ api: true, permission: PERMISSIONS.HOME_VIEW }),
  controller.homeData,
);

module.exports = router;
