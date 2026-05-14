const express = require('express');
const router = express.Router();
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead, bulkCreateLeads
} = require('../controllers/lead.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.post('/', createLead);
router.post('/bulk', bulkCreateLeads);
router.get('/', getLeads);
router.get('/:id', getLeadById);
router.put('/:id', authorizeRoles('owner', 'sales_head', 'manager', 'inside_sales'), updateLead);
router.delete('/:id', authorizeRoles('owner', 'sales_head'), deleteLead);

module.exports = router;