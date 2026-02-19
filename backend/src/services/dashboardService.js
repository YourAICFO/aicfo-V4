const { Sequelize } = require('sequelize');
const {
  CashBalance,
  AIInsight,
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLiquidityMetric,
  CFOAlert,
  CFOMetric,
  FinancialTransaction
} = require('../models');

const normalizeMonth = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 7);
  }
  if (typeof value === 'number') {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString().slice(0, 7);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 7);
  }
  return null;
};

const getLatestClosedMonthStart = (now = new Date()) => {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
};

const getLatestClosedMonthKey = (now = new Date()) => {
  const latestClosedStart = getLatestClosedMonthStart(now);
  return normalizeMonth(latestClosedStart);
};

const getClosedRange = (months = 3, now = new Date()) => {
  const latestClosedStart = getLatestClosedMonthStart(now);
  const rangeStart = new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - (months - 1), 1);
  const rangeEndExclusive = new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() + 1, 1);
  return { latestClosedStart, rangeStart, rangeEndExclusive };
};

/** Prefer ETL-precomputed values from CFOMetric when available. specs: [{ metricKey, timeScope }]. Returns map metricKey -> number or null. */
const getCFOMetricsMap = async (companyId, specs) => {
  if (!specs || specs.length === 0) return {};
  const rows = await CFOMetric.findAll({
    where: {
      companyId,
      [Sequelize.Op.or]: specs.map(({ metricKey, timeScope }) => ({ metricKey, timeScope: timeScope || 'live' }))
    },
    raw: true
  });
  const map = {};
  for (const spec of specs) {
    const row = rows.find(
      (r) => r.metricKey === spec.metricKey && r.timeScope === (spec.timeScope || 'live')
    );
    const val = row?.metric_value;
    map[spec.metricKey] = val != null && val !== '' ? Number(val) : null;
  }
  return map;
};

const getCFOOverview = async (companyId) => {
  const now = new Date();
  const { latestClosedStart, rangeStart, rangeEndExclusive } = getClosedRange(3, now);
  const latestClosedKey = normalizeMonth(latestClosedStart);

  // Live current cash balance (fallback to historical cash if none)
  const currentCashRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true });
  let bankBalance = 0;
  let cashBalance = 0;
  if (currentCashRows.length > 0) {
    cashBalance = currentCashRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  } else {
    const latestCash = await CashBalance.findOne({
      where: { companyId },
      order: [['date', 'DESC']]
    });
    cashBalance = latestCash ? parseFloat(latestCash.amount) : 0;
  }

  const summaryRows = await MonthlyTrialBalanceSummary.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    order: [['month', 'ASC']],
    raw: true
  });

  if (summaryRows.length === 0) {
    // No snapshots yet – surface an explicit not-ready state rather than recomputing from transactions.
    const recentInsights = await AIInsight.findAll({
      where: { companyId, isDismissed: false },
      order: [['created_at', 'DESC']],
      limit: 5
    });
    const unreadCount = await AIInsight.count({
      where: { companyId, isRead: false, isDismissed: false }
    });

    return {
      dataReady: false,
      reason: 'snapshots_missing',
      cashPosition: {
        currentBalance: cashBalance,
        bankBalance,
        currency: 'INR'
      },
      runway: {
        months: null,
        status: 'UNKNOWN',
        avgMonthlyInflow: null,
        avgMonthlyOutflow: null,
        netCashFlow: null
      },
      kpis: [],
      alerts: [],
      insights: {
        recent: recentInsights,
        unreadCount
      }
    };
  }

  let currentCash = 0;
  const latestSummaryFromRange = summaryRows[summaryRows.length - 1];
  currentCash = parseFloat(latestSummaryFromRange.cash_and_bank_balance || 0);

  const cfoSpecs = [
    { metricKey: 'cash_runway_months', timeScope: 'live' },
    { metricKey: 'revenue_last_closed', timeScope: 'last_closed_month' },
    { metricKey: 'expenses_last_closed', timeScope: 'last_closed_month' },
    { metricKey: 'net_profit_last_closed', timeScope: 'last_closed_month' },
    { metricKey: 'revenue_growth_3m', timeScope: '3m' },
    { metricKey: 'expense_growth_3m', timeScope: '3m' },
    { metricKey: 'debtors_balance_live', timeScope: 'live' },
    { metricKey: 'creditors_balance_live', timeScope: 'live' }
  ];
  const cfo = await getCFOMetricsMap(companyId, cfoSpecs);

  // Get monthly inflows and outflows for last 3 closed months from snapshots only
  const monthlyData = summaryRows.map((row) => ({
    month: row.month,
    revenue: parseFloat(row.total_revenue || 0),
    expenses: parseFloat(row.total_expenses || 0)
  }));

  // Calculate averages
  const monthlyInflows = [];
  const monthlyOutflows = [];

  for (let i = 0; i < 3; i++) {
    const month = new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - i, 1);
    const monthStr = normalizeMonth(month) || getLatestClosedMonthKey(now);
    const row = monthlyData.find(d => normalizeMonth(d.month) === monthStr);
    monthlyInflows.push(row ? parseFloat(row.revenue) : 0);
    monthlyOutflows.push(row ? parseFloat(row.expenses) : 0);
  }

  const availableCount = Math.max(monthlyInflows.filter(v => v !== 0).length || 0, 1);
  const avgMonthlyInflow = monthlyInflows.reduce((a, b) => a + b, 0) / availableCount;
  const avgMonthlyOutflow = monthlyOutflows.reduce((a, b) => a + b, 0) / availableCount;
  const netCashFlow = avgMonthlyInflow - avgMonthlyOutflow;
  const avgNetCashFlow = netCashFlow;

  // Calculate runway
  let runwayMonths = 0;
  let runwayStatus = 'RED';

  const cashBase = cashBalance || (currentCash + bankBalance);
  if (avgNetCashFlow >= 0) {
    runwayMonths = 99;
    runwayStatus = 'GREEN';
  } else {
    const denom = Math.abs(avgNetCashFlow);
    runwayMonths = denom > 0 ? (cashBase / denom) : 0;
    if (runwayMonths >= 6) {
      runwayStatus = 'GREEN';
    } else if (runwayMonths >= 3) {
      runwayStatus = 'AMBER';
    } else {
      runwayStatus = 'RED';
    }
  }

  // Get recent insights
  const recentInsights = await AIInsight.findAll({
    where: { companyId, isDismissed: false },
    order: [['created_at', 'DESC']],
    limit: 5
  });

  // Count unread insights
  const unreadCount = await AIInsight.count({
    where: { companyId, isRead: false, isDismissed: false }
  });

  const latestSummary = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    raw: true
  });
  const prevSummary = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: normalizeMonth(new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - 1, 1)) },
    raw: true
  });
  const prev6Summary = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: normalizeMonth(new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - 6, 1)) },
    raw: true
  });
  const revenueLatest = cfo.revenue_last_closed != null
    ? cfo.revenue_last_closed
    : Number(latestSummary?.total_revenue || 0);
  const expenseLatest = cfo.expenses_last_closed != null
    ? cfo.expenses_last_closed
    : Number(latestSummary?.total_expenses || 0);
  const netProfitLatest = cfo.net_profit_last_closed != null
    ? cfo.net_profit_last_closed
    : Number(latestSummary?.net_profit || (revenueLatest - expenseLatest));
  const margin = revenueLatest > 0 ? netProfitLatest / revenueLatest : 0;

  const currentDebtors = await CurrentDebtor.findAll({ where: { companyId }, raw: true });
  const currentCreditors = await CurrentCreditor.findAll({ where: { companyId }, raw: true });
  const debtorsOutstanding = cfo.debtors_balance_live != null
    ? cfo.debtors_balance_live
    : currentDebtors.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const creditorsOutstanding = cfo.creditors_balance_live != null
    ? cfo.creditors_balance_live
    : currentCreditors.reduce((sum, r) => sum + Number(r.balance || 0), 0);

  const revenueGrowth3m = cfo.revenue_growth_3m != null
    ? cfo.revenue_growth_3m
    : (prevSummary?.total_revenue
      ? (revenueLatest - Number(prevSummary.total_revenue || 0)) / Number(prevSummary.total_revenue || 1)
      : 0);
  const expenseGrowth3m = cfo.expense_growth_3m != null
    ? cfo.expense_growth_3m
    : (prevSummary?.total_expenses
      ? (expenseLatest - Number(prevSummary.total_expenses || 0)) / Number(prevSummary.total_expenses || 1)
      : 0);
  const revenueGrowth6m = prev6Summary?.total_revenue
    ? (revenueLatest - Number(prev6Summary.total_revenue || 0)) / Number(prev6Summary.total_revenue || 1)
    : 0;
  const expenseGrowth6m = prev6Summary?.total_expenses
    ? (expenseLatest - Number(prev6Summary.total_expenses || 0)) / Number(prev6Summary.total_expenses || 1)
    : 0;

  const needsAttention = runwayStatus === 'RED' || debtorsOutstanding > 0;

  const liquidityMetric = await CurrentLiquidityMetric.findOne({ where: { companyId }, raw: true });
  const alerts = await CFOAlert.findAll({ where: { companyId }, order: [['generated_at', 'DESC']], raw: true });

  return {
    dataReady: true,
    cashPosition: {
      currentBalance: cashBalance || (currentCash + bankBalance),
      bankBalance,
      currency: 'INR'
    },
    runway: {
      months: cfo.cash_runway_months != null
        ? Number(cfo.cash_runway_months)
        : (liquidityMetric?.cash_runway_months !== null && liquidityMetric?.cash_runway_months !== undefined
          ? Number(liquidityMetric.cash_runway_months)
          : Math.round(runwayMonths * 10) / 10),
      status: runwayStatus,
      avgMonthlyInflow: Math.round(avgMonthlyInflow),
      avgMonthlyOutflow: Math.round(avgMonthlyOutflow),
      netCashFlow: Math.round(netCashFlow)
    },
    kpis: [
      { key: 'revenue', label: 'Revenue', value: revenueLatest, link: '/revenue' },
      { key: 'net_profit', label: 'Net Profit', value: netProfitLatest, link: '/revenue' },
      { key: 'margin', label: 'Margin', value: margin, link: '/revenue' },
      { key: 'cash_balance', label: 'Cash Balance', value: cashBalance || (currentCash + bankBalance), link: '/cashflow' },
      { key: 'burn_rate', label: 'Burn Rate', value: avgMonthlyOutflow, link: '/cashflow' },
      { key: 'cash_runway', label: 'Cash Runway', value: cfo.cash_runway_months ?? liquidityMetric?.cash_runway_months ?? runwayMonths, link: '/dashboard' },
      { key: 'debtors', label: 'Debtors Outstanding', value: debtorsOutstanding, link: '/debtors' },
      { key: 'creditors', label: 'Creditors Outstanding', value: creditorsOutstanding, link: '/creditors' },
      { key: 'revenue_growth_3m', label: 'Revenue Growth (3M)', value: revenueGrowth3m, link: '/revenue' },
      { key: 'expense_growth_3m', label: 'Expense Growth (3M)', value: expenseGrowth3m, link: '/expenses' },
      { key: 'revenue_growth_6m', label: 'Revenue Growth (6M)', value: revenueGrowth6m, link: '/revenue' },
      { key: 'expense_growth_6m', label: 'Expense Growth (6M)', value: expenseGrowth6m, link: '/expenses' },
      { key: 'needs_attention', label: 'Needs Attention', value: needsAttention, link: '/ai-insights' }
    ],
    alerts,
    insights: {
      recent: recentInsights,
      unreadCount
    }
  };
};

const getRevenueDashboard = async (companyId, period = '3m') => {
  const now = new Date();
  const { latestClosedStart, rangeStart, rangeEndExclusive } = getClosedRange(3, now);

  const latestClosedKey = normalizeMonth(latestClosedStart);
  const summaryRows = await MonthlyTrialBalanceSummary.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    order: [['month', 'ASC']],
    raw: true
  });

  if (summaryRows.length === 0) {
    return {
      dataReady: false,
      reason: 'snapshots_missing',
      summary: {
        totalRevenue: 0,
        growthRate: 0,
        period
      },
      monthlyTrend: [],
      byCategory: []
    };
  }

  // Monthly revenue trend (3 closed months) from snapshots only
  const monthlyRevenue = summaryRows.map(row => ({
    month: row.month,
    total: parseFloat(row.total_revenue || 0)
  }));

  // Revenue by category from normalized breakdowns only
  let revenueByCategory = await MonthlyRevenueBreakdown.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    attributes: [
      'normalized_revenue_category',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['normalized_revenue_category'],
    order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
    raw: true
  });
  // Total revenue (latest closed month only) from snapshots
  const totalRevenue = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [['total_revenue', 'total']],
    raw: true
  });

  // Latest closed month vs previous closed month growth
  const prevClosedStart = new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - 1, 1);

  const currentMonthRevenue = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [['total_revenue', 'total']],
    raw: true
  });

  const prevRevenue = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: normalizeMonth(prevClosedStart) },
    attributes: [['total_revenue', 'total']],
    raw: true
  });

  const periodTotal = parseFloat(totalRevenue?.total || 0);
  const currentTotal = parseFloat(currentMonthRevenue?.total || 0);
  const previousTotal = parseFloat(prevRevenue?.total || 0);
  const growthRate = previousTotal > 0
    ? ((currentTotal - previousTotal) / previousTotal) * 100
    : 0;

  return {
    dataReady: true,
    summary: {
      totalRevenue: periodTotal,
      growthRate: Math.round(growthRate * 100) / 100,
      period
    },
    monthlyTrend: monthlyRevenue.map(r => ({
      month: normalizeMonth(r.month) ? `${normalizeMonth(r.month)}-01` : r.month,
      amount: parseFloat(r.total)
    })),
    byCategory: revenueByCategory.map(c => ({
      category: c.normalized_revenue_category || c.category,
      amount: parseFloat(c.total)
    }))
  };
};

const getExpenseDashboard = async (companyId, period = '3m') => {
  const now = new Date();
  const { latestClosedStart, rangeStart, rangeEndExclusive } = getClosedRange(3, now);

  const latestClosedKey = normalizeMonth(latestClosedStart);
  const summaryRows = await MonthlyTrialBalanceSummary.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    order: [['month', 'ASC']],
    raw: true
  });

  if (summaryRows.length === 0) {
    return {
      dataReady: false,
      reason: 'snapshots_missing',
      summary: {
        totalExpenses: 0,
        period
      },
      monthlyTrend: [],
      byCategory: [],
      topExpenses: []
    };
  }

  // Monthly expense trend (3 closed months) from snapshots
  const monthlyExpenses = summaryRows.map(row => ({
    month: row.month,
    total: parseFloat(row.total_expenses || 0)
  }));

  // Expenses by category from normalized breakdowns
  let expensesByCategory = await MonthlyExpenseBreakdown.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    attributes: [
      'normalized_expense_category',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['normalized_expense_category'],
    order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
    raw: true
  });
  // Total expenses (latest closed month only) from snapshots
  const totalExpenses = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [['total_expenses', 'total']],
    raw: true
  });

  // Top expenses are not directly materialized; we can skip them when enforcing strict ETL-only paths
  const topExpenses = [];

  return {
    dataReady: true,
    summary: {
      totalExpenses: parseFloat(totalExpenses?.total || 0),
      period
    },
    monthlyTrend: monthlyExpenses.map(e => ({
      month: normalizeMonth(e.month) ? `${normalizeMonth(e.month)}-01` : e.month,
      amount: parseFloat(e.total)
    })),
    byCategory: expensesByCategory.map(c => ({
      category: c.normalized_expense_category || c.category,
      amount: parseFloat(c.total)
    })),
    topExpenses: topExpenses.map(e => ({
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount),
      date: e.date
    }))
  };
};

const getCashflowDashboard = async (companyId, period = '3m') => {
  const now = new Date();
  const { rangeStart, rangeEndExclusive } = getClosedRange(3, now);

  // Get monthly cashflow data
  const latestClosedKey = getLatestClosedMonthKey(now);
  const summaryRows = await MonthlyTrialBalanceSummary.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    order: [['month', 'ASC']],
    raw: true
  });

  // Format monthly data from snapshots only
  const monthlyMap = {};
  summaryRows.forEach((row) => {
    const monthKey = row.month;
    if (!monthKey) return;
    monthlyMap[monthKey] = {
      inflow: parseFloat(row.total_revenue || 0),
      outflow: parseFloat(row.total_expenses || 0)
    };
  });

  const monthlyCashflow = Object.keys(monthlyMap)
    .sort()
    .map((monthKey) => {
      const inflowTotal = monthlyMap[monthKey].inflow;
      const outflowTotal = monthlyMap[monthKey].outflow;
      return {
        month: `${monthKey}-01`,
        inflow: inflowTotal,
        outflow: outflowTotal,
        net: inflowTotal - outflowTotal
      };
    });

  // Get cash balance history
  const cashHistory = await CashBalance.findAll({
    where: {
      companyId,
      date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
    },
    order: [['date', 'ASC']],
    raw: true
  });
  let cashHistoryRows = cashHistory;
  if (cashHistoryRows.length === 0) {
    const latestOpening = await FinancialTransaction.findOne({
      where: { companyId, type: 'OPENING_BALANCE' },
      order: [['date', 'DESC']],
      raw: true
    });
    if (latestOpening) {
      cashHistoryRows = [{
        date: latestOpening.date,
        amount: latestOpening.amount
      }];
    }
  }

  return {
    monthlyCashflow,
    cashHistory: cashHistoryRows.map(c => ({
      date: c.date,
      amount: parseFloat(c.amount)
    }))
  };
};

module.exports = {
  getCFOOverview,
  getRevenueDashboard,
  getExpenseDashboard,
  getCashflowDashboard
};
