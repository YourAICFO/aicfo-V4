const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { dashboardService, adminUsageService } = require('../services');

// GET /api/dashboard/overview
router.get('/overview', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await dashboardService.getCFOOverview(req.companyId);
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'dashboard_open',
      eventName: 'dashboard_overview'
    });
    res.json({
      success: true,
      data
    });
  } catch (error) {
    require('../utils/logger').logger.error({ err: error }, 'Overview error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/dashboard/revenue
router.get('/revenue', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const period = req.query.period || '6m';
    const data = await dashboardService.getRevenueDashboard(req.companyId, period);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    require('../utils/logger').logger.error({ err: error }, 'Revenue dashboard error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/dashboard/expenses
router.get('/expenses', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const period = req.query.period || '6m';
    const data = await dashboardService.getExpenseDashboard(req.companyId, period);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    require('../utils/logger').logger.error({ err: error }, 'Expense dashboard error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/dashboard/cashflow
router.get('/cashflow', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const period = req.query.period || '6m';
    const data = await dashboardService.getCashflowDashboard(req.companyId, period);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    require('../utils/logger').logger.error({ err: error }, 'Cashflow dashboard error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
