const express = require("express");
const controller = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/me", authMiddleware({ api: true }), controller.me);

module.exports = router;
