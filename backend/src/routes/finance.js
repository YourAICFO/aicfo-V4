const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { z } = require('zod');
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { validateBody } = require('../middleware/validateBody');
const { debtorsService, creditorsService, adminUsageService, plPackService, alertsService, reportService, dataHealthService, planService, usageService } = require('../services');

const monthBodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  forceRegenerate: z.boolean().optional(),
});

const alertActionSchema = z.object({
  ruleKey: z.string().min(1, 'ruleKey is required'),
  days: z.number().int().refine((v) => v === 7 || v === 30, 'days must be 7 or 30').optional(),
});
const { CFOMetric, CurrentLoan, MonthlyTrialBalanceSummary } = require('../models');

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

const ENFORCE_USAGE_LIMITS = process.env.ENFORCE_USAGE_LIMITS === 'true';
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

router.post('/pl-ai-explanation', authenticate, requireCompany, checkSubscriptionAccess, validateBody(monthBodySchema), async (req, res) => {
  try {
    const companyId = req.companyId;
    const monthKey = normalizeMonthQuery(req.body?.month);
    const forceRegenerate = Boolean(req.body?.forceRegenerate);
    if (!monthKey) {
      return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
    }
    const { caps } = await planService.getCompanyPlan(companyId);
    const usage = await usageService.getUsage(companyId, 'ai_pl_explanation', currentMonthKey());
    if (usage >= caps.aiExplanationLimit) {
      if (ENFORCE_USAGE_LIMITS) {
        return res.status(403).json({
          success: false,
          error: 'Monthly AI explanation limit reached. Upgrade for more.',
          code: 'USAGE_LIMIT'
        });
      }
      res.setHeader('X-Usage-Warning', 'Monthly AI explanation limit reached');
    }
    const result = await plPackService.getOrCreateAiExplanation(companyId, monthKey, {
      forceRegenerate,
      userId: req.userId
    });
    await usageService.recordUsage(companyId, 'ai_pl_explanation', 1);
    res.json({ success: true, aiDraftText: result.aiDraftText, aiDraftUpdatedAt: result.aiDraftUpdatedAt });
  } catch (error) {
    const status = error.statusCode === 403 || error.code === 'USAGE_LIMIT' ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/data-health', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const health = await dataHealthService.getDataHealth(req.companyId);
    const impactMessages = dataHealthService.getImpactMessages(health);
    const suggestedNextSteps = dataHealthService.getSuggestedNextSteps(health);
    res.json({
      success: true,
      data: {
        ...health,
        impactMessages,
        suggestedNextSteps
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/monthly-report', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const monthKey = normalizeMonthQuery(req.query.month);
    if (!monthKey) {
      return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
    }
    const { caps } = await planService.getCompanyPlan(companyId);
    if (!caps.reports) {
      return res.status(403).json({ success: false, error: 'Reports not available on your plan.', code: 'PLAN_FEATURE' });
    }
    const usage = await usageService.getUsage(companyId, 'report_download', currentMonthKey());
    if (usage >= caps.reportDownloadLimit) {
      if (ENFORCE_USAGE_LIMITS) {
        return res.status(403).json({
          success: false,
          error: 'Monthly report download limit reached. Upgrade for more.',
          code: 'USAGE_LIMIT'
        });
      }
      res.setHeader('X-Usage-Warning', 'Monthly report download limit reached');
    }
    const report = await reportService.buildMonthlyReport(companyId, monthKey);
    const pdfBuffer = await reportService.renderMonthlyReportPdf(report);
    await usageService.recordUsage(companyId, 'report_download', 1);
    const companyName = (report.company && report.company.name)
      ? String(report.company.name).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim() || 'Company'
      : 'Company';
    const filename = `${companyName}-Monthly-Report-${monthKey}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    const status = error.statusCode === 403 || error.code === 'USAGE_LIMIT' ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
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

router.post('/alerts/snooze', authenticate, requireCompany, checkSubscriptionAccess, validateBody(alertActionSchema), async (req, res) => {
  try {
    const ruleKey = req.body?.ruleKey;
    const days = req.body?.days != null ? Number(req.body.days) : null;
    if (!ruleKey || typeof ruleKey !== 'string') {
      return res.status(400).json({ success: false, error: 'ruleKey is required' });
    }
    if (days !== 7 && days !== 30) {
      return res.status(400).json({ success: false, error: 'days must be 7 or 30' });
    }
    await alertsService.snooze(req.companyId, ruleKey, days);
    const alerts = await alertsService.getAlerts(req.companyId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/alerts/dismiss', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const ruleKey = req.body?.ruleKey;
    if (!ruleKey || typeof ruleKey !== 'string') {
      return res.status(400).json({ success: false, error: 'ruleKey is required' });
    }
    await alertsService.dismiss(req.companyId, ruleKey);
    const alerts = await alertsService.getAlerts(req.companyId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/alerts/clear', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const ruleKey = req.body?.ruleKey;
    if (!ruleKey || typeof ruleKey !== 'string') {
      return res.status(400).json({ success: false, error: 'ruleKey is required' });
    }
    await alertsService.clear(req.companyId, ruleKey);
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
      netWorkingCapital,
      cashConversionCycle,
      cashGapExInventory,
      receivableDays,
      payableDays,
      interestExpenseLatest,
      interestCoverage,
      loansAggregate,
      loansMetricFallback,
      inventoryTotal,
      inventoryDelta,
      inventoryDays,
      latestSummary
    ] = await Promise.all([
      getLatestMetricValue(companyId, 'working_capital'),
      getLatestMetricValue(companyId, 'net_working_capital'),
      getLatestMetricValue(companyId, 'cash_conversion_cycle'),
      getLatestMetricValue(companyId, 'cash_gap_ex_inventory'),
      getLatestMetricValue(companyId, 'debtor_days'),
      getLatestMetricValue(companyId, 'creditor_days'),
      getLatestMetricValue(companyId, 'interest_expense_latest'),
      getLatestMetricValue(companyId, 'interest_coverage'),
      CurrentLoan.findOne({
        where: { companyId },
        attributes: [[fn('COALESCE', fn('SUM', col('balance')), 0), 'total']],
        raw: true
      }),
      getLatestMetricValue(companyId, 'loans_balance_live'),
      getLatestMetricValue(companyId, 'inventory_total'),
      getLatestMetricValue(companyId, 'inventory_delta'),
      getLatestMetricValue(companyId, 'inventory_days'),
      MonthlyTrialBalanceSummary.findOne({
        where: { companyId },
        order: [['month', 'DESC']],
        attributes: ['totalRevenue', 'totalExpenses'],
        raw: true
      })
    ]);

    const loanTotalFromTable = Number(loansAggregate?.total);
    const loansTotalOutstanding = Number.isFinite(loanTotalFromTable)
      ? loanTotalFromTable
      : (Number.isFinite(Number(loansMetricFallback)) ? Number(loansMetricFallback) : null);

    const revenueLatest = Number(latestSummary?.totalRevenue ?? latestSummary?.total_revenue ?? 0) || 0;
    const expensesLatest = Number(latestSummary?.totalExpenses ?? latestSummary?.total_expenses ?? 0) || 0;
    const plActivityLatestMonth = revenueLatest > 0 || expensesLatest > 0;

    const data = {
      working_capital: workingCapital,
      net_working_capital: netWorkingCapital,
      liquidity_position: workingCapital,
      cash_conversion_cycle: cashConversionCycle,
      cash_gap_ex_inventory: cashGapExInventory,
      receivable_days: receivableDays,
      payable_days: payableDays,
      loans_total_outstanding: loansTotalOutstanding,
      interest_expense_latest: interestExpenseLatest,
      interest_coverage: interestCoverage,
      inventory_total: inventoryTotal,
      inventory_delta: inventoryDelta,
      inventory_days: inventoryDays,
      pl_activity_latest_month: plActivityLatestMonth,
      sources: {
        working_capital: { metric_key: 'working_capital', value: workingCapital },
        net_working_capital: { metric_key: 'net_working_capital', value: netWorkingCapital },
        liquidity_position: { metric_key: 'working_capital', value: workingCapital },
        cash_conversion_cycle: { metric_key: 'cash_conversion_cycle', value: cashConversionCycle },
        cash_gap_ex_inventory: { metric_key: 'cash_gap_ex_inventory', value: cashGapExInventory },
        receivable_days: { metric_key: 'debtor_days', value: receivableDays },
        payable_days: { metric_key: 'creditor_days', value: payableDays },
        loans_total_outstanding: {
          metric_key: Number.isFinite(loanTotalFromTable) ? 'current_loans.sum(balance)' : 'loans_balance_live',
          value: loansTotalOutstanding
        },
        interest_expense_latest: { metric_key: 'interest_expense_latest', value: interestExpenseLatest },
        interest_coverage: { metric_key: 'interest_coverage', value: interestCoverage },
        inventory_total: { metric_key: 'inventory_total', value: inventoryTotal },
        inventory_delta: { metric_key: 'inventory_delta', value: inventoryDelta },
        inventory_days: { metric_key: 'inventory_days', value: inventoryDays }
      }
    };

    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
