const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser, deleteUser } = require('../controllers/auth.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.get('/', verifyToken, authorizeRoles('owner', 'sales_head', 'inside_sales'), getAllUsers);
router.put('/:id', verifyToken, authorizeRoles('owner', 'sales_head'), updateUser);
router.delete('/:id', verifyToken, authorizeRoles('owner', 'sales_head'), deleteUser);

module.exports = router;
