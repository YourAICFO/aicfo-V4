const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { debtorsService, creditorsService, adminUsageService, plPackService, alertsService } = require('../services');
const { CFOMetric, CurrentLoan } = require('../models');

const getLatestMetricValue = async (companyId, metricKey) => {
  const row = await CFOMetric.findOne({
    where: {
      companyId,
      metricKey,
      timeScope: { [Op.ne]: 'month' }
    },
    order: [['updatedAt', 'DESC']],
    raw: true
  });
  if (!row) return null;
  const val = row.metric_value ?? row.metricValue;
  const numeric = Number(val);
  return Number.isFinite(numeric) ? numeric : null;
};

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

const normalizeMonthQuery = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 7);
};

router.get('/pl-months', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const data = await plPackService.getPlMonths(req.companyId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/pl-pack', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const monthKey = normalizeMonthQuery(req.query.month);
    if (!monthKey) {
      return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
    }
    const data = await plPackService.getPlPackWithDrivers(companyId, monthKey);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/pl-remarks', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const monthKey = normalizeMonthQuery(req.query.month);
    if (!monthKey) {
      return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
    }
    const data = await plPackService.getRemarks(companyId, monthKey);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/pl-remarks', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const monthKey = normalizeMonthQuery(req.body?.month);
    const text = req.body?.text != null ? String(req.body.text) : null;
    if (!monthKey) {
      return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
    }
    const result = await plPackService.upsertRemarks(companyId, monthKey, text, req.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/pl-ai-explanation', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const monthKey = normalizeMonthQuery(req.body?.month);
    const forceRegenerate = Boolean(req.body?.forceRegenerate);
    if (!monthKey) {
      return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
    }
    const result = await plPackService.getOrCreateAiExplanation(companyId, monthKey, {
      forceRegenerate,
      userId: req.userId
    });
    res.json({ success: true, aiDraftText: result.aiDraftText, aiDraftUpdatedAt: result.aiDraftUpdatedAt });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/alerts', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const alerts = await alertsService.getAlerts(req.companyId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/working-capital', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.companyId;

    const [
      workingCapital,
      cashConversionCycle,
      receivableDays,
      payableDays,
      interestExpenseLatest,
      interestCoverage,
      loansAggregate,
      loansMetricFallback
    ] = await Promise.all([
      getLatestMetricValue(companyId, 'working_capital'),
      getLatestMetricValue(companyId, 'cash_conversion_cycle'),
      getLatestMetricValue(companyId, 'debtor_days'),
      getLatestMetricValue(companyId, 'creditor_days'),
      getLatestMetricValue(companyId, 'interest_expense_latest'),
      getLatestMetricValue(companyId, 'interest_coverage'),
      CurrentLoan.findOne({
        where: { companyId },
        attributes: [[fn('COALESCE', fn('SUM', col('balance')), 0), 'total']],
        raw: true
      }),
      getLatestMetricValue(companyId, 'loans_balance_live')
    ]);

    const loanTotalFromTable = Number(loansAggregate?.total);
    const loansTotalOutstanding = Number.isFinite(loanTotalFromTable)
      ? loanTotalFromTable
      : (Number.isFinite(Number(loansMetricFallback)) ? Number(loansMetricFallback) : null);

    const data = {
      working_capital: workingCapital,
      cash_conversion_cycle: cashConversionCycle,
      receivable_days: receivableDays,
      payable_days: payableDays,
      loans_total_outstanding: loansTotalOutstanding,
      interest_expense_latest: interestExpenseLatest,
      interest_coverage: interestCoverage,
      sources: {
        working_capital: { metric_key: 'working_capital', value: workingCapital },
        cash_conversion_cycle: { metric_key: 'cash_conversion_cycle', value: cashConversionCycle },
        receivable_days: { metric_key: 'debtor_days', value: receivableDays },
        payable_days: { metric_key: 'creditor_days', value: payableDays },
        loans_total_outstanding: {
          metric_key: Number.isFinite(loanTotalFromTable) ? 'current_loans.sum(balance)' : 'loans_balance_live',
          value: loansTotalOutstanding
        },
        interest_expense_latest: { metric_key: 'interest_expense_latest', value: interestExpenseLatest },
        interest_coverage: { metric_key: 'interest_coverage', value: interestCoverage }
      }
    };

    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
