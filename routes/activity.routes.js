const express = require('express');
const router = express.Router();
const { createActivity, getActivitiesByLead, getAllActivities, updateActivity, deleteActivity } = require('../controllers/activity.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.post('/', createActivity);
router.get('/', getAllActivities);
router.get('/lead/:lead_id', getActivitiesByLead);
router.put('/:id', authorizeRoles('owner', 'sales_head'), updateActivity);
router.delete('/:id', authorizeRoles('owner', 'sales_head'), deleteActivity);

module.exports = router;