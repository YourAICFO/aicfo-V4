const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { dashboardService } = require('../services');

// GET /api/dashboard/overview
router.get('/overview', authenticate, requireCompany, async (req, res) => {
  try {
    const data = await dashboardService.getCFOOverview(req.companyId);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Overview error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/dashboard/revenue
router.get('/revenue', authenticate, requireCompany, async (req, res) => {
  try {
    const period = req.query.period || '6m';
    const data = await dashboardService.getRevenueDashboard(req.companyId, period);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Revenue dashboard error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/dashboard/expenses
router.get('/expenses', authenticate, requireCompany, async (req, res) => {
  try {
    const period = req.query.period || '6m';
    const data = await dashboardService.getExpenseDashboard(req.companyId, period);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Expense dashboard error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/dashboard/cashflow
router.get('/cashflow', authenticate, requireCompany, async (req, res) => {
  try {
    const period = req.query.period || '6m';
    const data = await dashboardService.getCashflowDashboard(req.companyId, period);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Cashflow dashboard error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
