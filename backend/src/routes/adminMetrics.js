const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdminEmail } = require('../middleware/requireAdminEmail');
const { adminUsageService } = require('../services');

router.get('/summary', authenticate, requireAdminEmail, async (req, res) => {
  try {
    const data = await adminUsageService.getMetricsSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/usage', authenticate, requireAdminEmail, async (req, res) => {
  try {
    const months = Number(req.query.months || 12);
    const data = await adminUsageService.getUsageByMonth(months);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/ai', authenticate, requireAdminEmail, async (req, res) => {
  try {
    const months = Number(req.query.months || 12);
    const data = await adminUsageService.getAIAnalytics(months);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/customers', authenticate, requireAdminEmail, async (req, res) => {
  try {
    const data = await adminUsageService.getCustomerMetrics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
