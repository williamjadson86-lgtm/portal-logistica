const express = require("express");
const controller = require("../controllers/noticeController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/avisos", authMiddleware(), controller.page);
router.get("/api/avisos", authMiddleware({ api: true }), controller.data);

module.exports = router;
