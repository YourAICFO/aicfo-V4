const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { adminUsageService } = require('../services');
const partyBalanceService = require('../services/partyBalanceService');

router.get('/debtors/summary', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await partyBalanceService.getSummary(req.companyId, 'debtor');
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'party_debtors_open',
      eventName: 'party_debtors_summary'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/creditors/summary', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await partyBalanceService.getSummary(req.companyId, 'creditor');
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'party_creditors_open',
      eventName: 'party_creditors_summary'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/debtors/list', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const data = await partyBalanceService.getList(req.companyId, 'debtor', limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/creditors/list', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const data = await partyBalanceService.getList(req.companyId, 'creditor', limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/summary', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const debtors = await partyBalanceService.getSummary(req.companyId, 'debtor');
    const creditors = await partyBalanceService.getSummary(req.companyId, 'creditor');
    res.json({ success: true, data: { debtors, creditors } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
