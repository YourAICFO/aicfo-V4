const express = require('express');
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { getDebtorsSummary } = require('../services/debtorCreditorService');
const { logUsageEvent } = require('../services/adminUsageService');

const router = express.Router();

router.get('/summary', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.company?.id;
    logUsageEvent({
      companyId,
      userId: req.user?.id || null,
      eventType: 'debtors_open',
      eventName: 'debtors_summary'
    });

    const summary = await getDebtorsSummary(companyId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load debtors summary' });
  }
});

module.exports = router;
