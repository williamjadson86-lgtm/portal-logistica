const express = require("express");
const controller = require("../controllers/supportController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/suporte", authMiddleware(), controller.page);
router.get("/api/suporte", authMiddleware({ api: true }), controller.data);

module.exports = router;
