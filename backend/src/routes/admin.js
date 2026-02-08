const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { adminUsageService } = require('../services');
const { CFOMetric } = require('../models');

router.get('/usage/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getUsageSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/ai/questions', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getAIQuestions();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/companies/activity', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getCompaniesActivity();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /admin/cfo-metrics?companyId=...&timeScope=...&metricKey=...
router.get('/cfo-metrics', authenticate, requireAdmin, async (req, res) => {
  try {
    const { companyId, timeScope, metricKey } = req.query;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }
    const where = { companyId };
    if (timeScope) where.timeScope = timeScope;
    if (metricKey) where.metricKey = metricKey;
    const rows = await CFOMetric.findAll({
      where,
      order: [['updated_at', 'DESC']],
      raw: true
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
