const express = require("express");
const controller = require("../controllers/profileController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/perfil", authMiddleware(), controller.page);
router.get("/api/perfil", authMiddleware({ api: true }), controller.data);

module.exports = router;
