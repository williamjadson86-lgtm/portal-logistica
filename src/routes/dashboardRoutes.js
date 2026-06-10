const express = require("express");
const controller = require("../controllers/dashboardController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/api/dashboard", authMiddleware({ api: true }), controller.getDashboard);

module.exports = router;
