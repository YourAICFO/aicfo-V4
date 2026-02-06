const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { getStatus } = require('../controllers/subscriptionController');

// GET /api/subscription/status
router.get('/status', authenticate, requireCompany, getStatus);

module.exports = router;
