const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { adminUsageService } = require('../services');
const adminControlTowerService = require('../services/adminControlTowerService');

router.get('/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getMetricsSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/customers', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getCustomerMetrics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/system', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminControlTowerService.getSystemMetrics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/business', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminControlTowerService.getBusinessMetrics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/usage', authenticate, requireAdmin, async (req, res) => {
  try {
    const detailed = req.query.detailed === 'true';
    if (detailed) {
      const months = Number(req.query.months || 12);
      const data = await adminUsageService.getUsageByMonth(months);
      return res.json({ success: true, data });
    }
    const data = await adminControlTowerService.getUsageMetrics();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/ai', authenticate, requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const detailed = req.query.detailed === 'true';
    if (detailed) {
      const months = Number(req.query.months || 12);
      const data = await adminUsageService.getAIAnalytics(months);
      return res.json({ success: true, data });
    }
    const data = await adminControlTowerService.getAIMetrics(days);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/connector', authenticate, requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const data = await adminControlTowerService.getConnectorMetrics(days);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/accounting', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminControlTowerService.getAccountingMetrics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/risk', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminControlTowerService.getRiskMetrics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
