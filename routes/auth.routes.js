const express = require('express');
const router = express.Router();
const { register, login, getAllUsers, updateUser, deleteUser, firebaseLogin } = require('../controllers/auth.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.post('/register', verifyToken, authorizeRoles('owner', 'sales_head'), register);
router.post('/login', login);
router.post('/firebase', firebaseLogin);
router.get('/users', verifyToken, authorizeRoles('owner', 'sales_head', 'inside_sales'), getAllUsers);
router.put('/users/:id', verifyToken, authorizeRoles('owner', 'sales_head'), updateUser);
router.delete('/users/:id', verifyToken, authorizeRoles('owner', 'sales_head'), deleteUser);

module.exports = router;