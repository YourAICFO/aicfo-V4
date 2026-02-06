const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { cashBalanceValidation } = require('../middleware/validation');
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

// POST /api/cash-balance
router.post('/', authenticate, requireCompany, checkSubscriptionAccess, cashBalanceValidation, async (req, res) => {
  try {
    const balance = await cashBalanceService.createCashBalance(req.companyId, req.body);
    res.status(201).json({
      success: true,
      message: 'Cash balance created successfully',
      data: balance
    });
  } catch (error) {
    console.error('Create cash balance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/cash-balance/:id
router.put('/:id', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const balance = await cashBalanceService.updateCashBalance(
      req.params.id,
      req.companyId,
      req.body
    );
    res.json({
      success: true,
      message: 'Cash balance updated successfully',
      data: balance
    });
  } catch (error) {
    console.error('Update cash balance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/cash-balance/:id
router.delete('/:id', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const result = await cashBalanceService.deleteCashBalance(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete cash balance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
