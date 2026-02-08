const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { debtorsService, creditorsService, adminUsageService } = require('../services');

router.get('/debtors/summary', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await debtorsService.getSummary(req.companyId);
    adminUsageService.logEvent(req.companyId, req.userId, 'debtors_open').catch(() => {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/debtors/top', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await debtorsService.getTop(req.companyId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/debtors/trends', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await debtorsService.getTrends(req.companyId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/creditors/summary', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await creditorsService.getSummary(req.companyId);
    adminUsageService.logEvent(req.companyId, req.userId, 'creditors_open').catch(() => {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/creditors/top', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await creditorsService.getTop(req.companyId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/creditors/trends', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await creditorsService.getTrends(req.companyId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
