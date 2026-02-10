const express = require('express');
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { logUsageEvent } = require('../services/adminUsageService');
const {
  getSyncStatus,
  getValidationForMonth
} = require('../services/snapshotValidator');

const router = express.Router();

router.get('/status', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.company?.id;
    logUsageEvent({
      companyId,
      userId: req.user?.id || null,
      eventType: 'sync_status_open',
      eventName: 'sync_status'
    });

    const status = await getSyncStatus(companyId);
    return res.json({
      success: true,
      data: status || {
        status: 'syncing',
        last_sync_completed_at: null,
        last_snapshot_month: null,
        last_balance_asof_date: null,
        error_message: null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load sync status' });
  }
});

router.get('/validation', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.company?.id;
    const month = req.query.month;
    if (!month) {
      return res.status(400).json({ success: false, error: 'month is required' });
    }
    const validation = await getValidationForMonth(companyId, month);
    return res.json({ success: true, data: validation });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load validation' });
  }
});

module.exports = router;
