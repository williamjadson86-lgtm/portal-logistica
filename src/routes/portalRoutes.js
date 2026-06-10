const express = require("express");
const controller = require("../controllers/portalController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", controller.entry);
router.get("/login", controller.loginPage);
router.get("/cadastro", controller.registerPage);
router.get("/home", authMiddleware(), controller.homePage);
router.get("/api/portal/home", authMiddleware({ api: true }), controller.homeData);
router.get("/api/portal/cards", authMiddleware({ api: true }), controller.homeData);

module.exports = router;
