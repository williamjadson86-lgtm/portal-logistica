const express = require("express");
const controller = require("../controllers/settingsController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/configuracoes", authMiddleware(), controller.page);
router.get("/api/configuracoes", authMiddleware({ api: true }), controller.data);

module.exports = router;
