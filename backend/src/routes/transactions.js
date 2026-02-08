const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { transactionService } = require('../services');

// GET /api/transactions
router.get('/', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const options = {
      type: req.query.type,
      category: req.query.category,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    };

    const result = await transactionService.getTransactions(req.companyId, options);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/transactions/:id
router.get('/:id', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const transaction = await transactionService.getTransactionById(req.params.id, req.companyId);
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/transactions/categories/list
router.get('/categories/list', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const categories = await transactionService.getCategories(req.companyId);
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
