const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { adminUsageService } = require('../services');

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

module.exports = router;
