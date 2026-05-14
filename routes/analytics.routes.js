const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analytics.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.get('/', verifyToken, authorizeRoles('owner', 'sales_head', 'manager'), getAnalytics);

module.exports = router;
