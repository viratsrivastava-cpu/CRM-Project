const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/ai.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/chat', verifyToken, chat);

module.exports = router;