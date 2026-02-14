const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');

// Transactions feature has been removed from the UI
// These endpoints are disabled to prevent access

// GET /api/transactions
router.get('/', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Transactions feature has been removed',
    message: 'The transactions feature is no longer available. Please use the dashboard and other financial reports for your transaction data.'
  });
});

// GET /api/transactions/:id
router.get('/:id', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Transactions feature has been removed',
    message: 'The transactions feature is no longer available. Please use the dashboard and other financial reports for your transaction data.'
  });
});

// GET /api/transactions/categories/list
router.get('/categories/list', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Transactions feature has been removed',
    message: 'The transactions feature is no longer available. Please use the dashboard and other financial reports for your transaction data.'
  });
});

module.exports = router;
