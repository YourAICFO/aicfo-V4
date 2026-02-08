const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { cashBalanceService } = require('../services');

// GET /api/cash-balance
router.get('/', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const options = {
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    };

    const result = await cashBalanceService.getCashBalances(req.companyId, options);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get cash balances error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/cash-balance/latest
router.get('/latest', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const balance = await cashBalanceService.getLatestBalance(req.companyId);
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Get latest balance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
