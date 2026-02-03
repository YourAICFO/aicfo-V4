const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { transactionValidation } = require('../middleware/validation');
const { transactionService } = require('../services');

// GET /api/transactions
router.get('/', authenticate, requireCompany, async (req, res) => {
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

// POST /api/transactions
router.post('/', authenticate, requireCompany, transactionValidation, async (req, res) => {
  try {
    const transaction = await transactionService.createTransaction(req.companyId, req.body);
    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/transactions/:id
router.get('/:id', authenticate, requireCompany, async (req, res) => {
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

// PUT /api/transactions/:id
router.put('/:id', authenticate, requireCompany, async (req, res) => {
  try {
    const transaction = await transactionService.updateTransaction(
      req.params.id,
      req.companyId,
      req.body
    );
    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', authenticate, requireCompany, async (req, res) => {
  try {
    const result = await transactionService.deleteTransaction(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/transactions/categories/list
router.get('/categories/list', authenticate, requireCompany, async (req, res) => {
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
