const express = require('express');
const router = express.Router();
const { createDeal, getDeals, getDealById, updateDeal, deleteDeal } = require('../controllers/deal.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.post('/', authorizeRoles('owner', 'sales_head', 'manager'), createDeal);
router.get('/', getDeals);
router.get('/:id', getDealById);
router.put('/:id', authorizeRoles('owner', 'sales_head', 'manager'), updateDeal);
router.delete('/:id', authorizeRoles('owner', 'sales_head'), deleteDeal);

module.exports = router;