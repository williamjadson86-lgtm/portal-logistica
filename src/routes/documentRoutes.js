const express = require("express");
const controller = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/documentos", authMiddleware(), controller.page);
router.get("/api/documentos", authMiddleware({ api: true }), controller.data);

module.exports = router;
