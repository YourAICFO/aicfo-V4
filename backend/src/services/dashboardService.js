const { Sequelize } = require('sequelize');
const {
  FinancialTransaction,
  CashBalance,
  AIInsight,
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  MonthlyDebtor,
  MonthlyCreditor
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

const getCFOOverview = async (companyId) => {
  const now = new Date();
  const { latestClosedStart, rangeStart, rangeEndExclusive } = getClosedRange(3, now);
  const latestClosedKey = normalizeMonth(latestClosedStart);

  // Get current cash balance
  const latestCash = await CashBalance.findOne({
    where: { companyId },
    order: [['date', 'DESC']]
  });
  const latestBank = await CashBalance.findOne({
    where: {
      companyId,
      bankName: { [Sequelize.Op.ne]: null }
    },
    order: [['date', 'DESC']]
  });

  let bankBalance = latestBank ? parseFloat(latestBank.amount) : 0;
  if (!latestBank) {
    bankBalance = 0;
  }

  const summaryRows = await MonthlyTrialBalanceSummary.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.gte]: normalizeMonth(rangeStart), [Sequelize.Op.lte]: latestClosedKey }
    },
    order: [['month', 'ASC']],
    raw: true
  });

  let currentCash = 0;
  if (summaryRows.length > 0) {
    const latestSummary = summaryRows[summaryRows.length - 1];
    currentCash = parseFloat(latestSummary.cash_and_bank_balance || 0);
  } else {
    const totals = await FinancialTransaction.findAll({
      where: { companyId },
      attributes: [
        'type',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: ['type'],
      raw: true
    });
    const revenueTotal = totals.find(t => t.type === 'REVENUE');
    const expenseTotal = totals.find(t => t.type === 'EXPENSE');
    const openingTotal = totals.find(t => t.type === 'OPENING_BALANCE');
    const revenue = parseFloat(revenueTotal?.total || 0);
    const expenses = parseFloat(expenseTotal?.total || 0);
    const opening = parseFloat(openingTotal?.total || 0);
    currentCash = opening + revenue - expenses;
  }

  // Get monthly inflows and outflows for last 6 months
  const monthlyData = summaryRows.length > 0
    ? summaryRows.map((row) => ({
      month: row.month,
      revenue: parseFloat(row.total_revenue || 0),
      expenses: parseFloat(row.total_expenses || 0)
    }))
    : await FinancialTransaction.findAll({
      where: {
        companyId,
        date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'month'],
        'type',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'type'],
      raw: true
    });

  // Calculate averages
  const monthlyInflows = [];
  const monthlyOutflows = [];
  const availableMonths = new Set(
    monthlyData
      .map((d) => normalizeMonth(d.month))
      .filter((m) => Boolean(m))
  );

  for (let i = 0; i < 3; i++) {
    const month = new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - i, 1);
    const monthStr = normalizeMonth(month) || getLatestClosedMonthKey(now);

    if (summaryRows.length > 0) {
      const row = monthlyData.find(d => normalizeMonth(d.month) === monthStr);
      monthlyInflows.push(row ? parseFloat(row.revenue) : 0);
      monthlyOutflows.push(row ? parseFloat(row.expenses) : 0);
    } else {
      const inflow = monthlyData.find(
        d => normalizeMonth(d.month) === monthStr && d.type === 'REVENUE'
      );
      const outflow = monthlyData.find(
        d => normalizeMonth(d.month) === monthStr && d.type === 'EXPENSE'
      );
      monthlyInflows.push(inflow ? parseFloat(inflow.total) : 0);
      monthlyOutflows.push(outflow ? parseFloat(outflow.total) : 0);
    }
  }

  const availableCount = Math.max(availableMonths.size, 1);
  const avgMonthlyInflow = monthlyInflows.reduce((a, b) => a + b, 0) / availableCount;
  const avgMonthlyOutflow = monthlyOutflows.reduce((a, b) => a + b, 0) / availableCount;
  const netCashFlow = avgMonthlyInflow - avgMonthlyOutflow;
  const avgNetCashFlow = netCashFlow;

  // Calculate runway
  let runwayMonths = 0;
  let runwayStatus = 'RED';

  const cashBase = currentCash + bankBalance;
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

  const latestClosedKey = normalizeMonth(latestClosedStart);
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
  const revenueLatest = Number(latestSummary?.total_revenue || 0);
  const expenseLatest = Number(latestSummary?.total_expenses || 0);
  const netProfitLatest = Number(latestSummary?.net_profit || (revenueLatest - expenseLatest));
  const margin = revenueLatest > 0 ? netProfitLatest / revenueLatest : 0;

  const debtorTotalRow = await MonthlyDebtor.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [[Sequelize.fn('MAX', Sequelize.col('total_debtors_balance')), 'total']],
    raw: true
  });
  const creditorTotalRow = await MonthlyCreditor.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [[Sequelize.fn('MAX', Sequelize.col('total_creditors_balance')), 'total']],
    raw: true
  });
  const debtorsOutstanding = Number(debtorTotalRow?.total || 0);
  const creditorsOutstanding = Number(creditorTotalRow?.total || 0);

  const revenueGrowth3m = prevSummary?.total_revenue
    ? (revenueLatest - Number(prevSummary.total_revenue || 0)) / Number(prevSummary.total_revenue || 1)
    : 0;
  const expenseGrowth3m = prevSummary?.total_expenses
    ? (expenseLatest - Number(prevSummary.total_expenses || 0)) / Number(prevSummary.total_expenses || 1)
    : 0;
  const revenueGrowth6m = prev6Summary?.total_revenue
    ? (revenueLatest - Number(prev6Summary.total_revenue || 0)) / Number(prev6Summary.total_revenue || 1)
    : 0;
  const expenseGrowth6m = prev6Summary?.total_expenses
    ? (expenseLatest - Number(prev6Summary.total_expenses || 0)) / Number(prev6Summary.total_expenses || 1)
    : 0;

  const needsAttention = runwayStatus === 'RED' || debtorsOutstanding > 0;

  return {
    cashPosition: {
      currentBalance: currentCash + bankBalance,
      bankBalance,
      currency: 'INR'
    },
    runway: {
      months: Math.round(runwayMonths * 10) / 10,
      status: runwayStatus,
      avgMonthlyInflow: Math.round(avgMonthlyInflow),
      avgMonthlyOutflow: Math.round(avgMonthlyOutflow),
      netCashFlow: Math.round(netCashFlow)
    },
    kpis: [
      { key: 'revenue', label: 'Revenue', value: revenueLatest, link: '/revenue' },
      { key: 'net_profit', label: 'Net Profit', value: netProfitLatest, link: '/revenue' },
      { key: 'margin', label: 'Margin', value: margin, link: '/revenue' },
      { key: 'cash_balance', label: 'Cash Balance', value: currentCash + bankBalance, link: '/cashflow' },
      { key: 'burn_rate', label: 'Burn Rate', value: avgMonthlyOutflow, link: '/cashflow' },
      { key: 'cash_runway', label: 'Cash Runway', value: runwayMonths, link: '/dashboard' },
      { key: 'debtors', label: 'Debtors Outstanding', value: debtorsOutstanding, link: '/debtors' },
      { key: 'creditors', label: 'Creditors Outstanding', value: creditorsOutstanding, link: '/creditors' },
      { key: 'revenue_growth_3m', label: 'Revenue Growth (3M)', value: revenueGrowth3m, link: '/revenue' },
      { key: 'expense_growth_3m', label: 'Expense Growth (3M)', value: expenseGrowth3m, link: '/expenses' },
      { key: 'revenue_growth_6m', label: 'Revenue Growth (6M)', value: revenueGrowth6m, link: '/revenue' },
      { key: 'expense_growth_6m', label: 'Expense Growth (6M)', value: expenseGrowth6m, link: '/expenses' },
      { key: 'needs_attention', label: 'Needs Attention', value: needsAttention, link: '/ai-insights' }
    ],
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

  // Monthly revenue trend (3 closed months)
  const monthlyRevenue = summaryRows.length > 0
    ? summaryRows.map(row => ({
      month: row.month,
      total: parseFloat(row.total_revenue || 0)
    }))
    : await FinancialTransaction.findAll({
      where: {
        companyId,
        type: 'REVENUE',
        date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'month'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'ASC']],
      raw: true
    });

  // Revenue by category
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
  if (revenueByCategory.length === 0) {
    revenueByCategory = await FinancialTransaction.findAll({
      where: {
        companyId,
        type: 'REVENUE',
        date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [
        'category',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: ['category'],
      order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
      raw: true
    });
  }

  // Total revenue (latest closed month only)
  let totalRevenue = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [['total_revenue', 'total']],
    raw: true
  });
  if (!totalRevenue) {
    totalRevenue = await FinancialTransaction.findOne({
      where: {
        companyId,
        type: 'REVENUE',
        date: { [Sequelize.Op.gte]: latestClosedStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
  }

  // Latest closed month vs previous closed month growth
  const prevClosedStart = new Date(latestClosedStart.getFullYear(), latestClosedStart.getMonth() - 1, 1);

  let currentMonthRevenue = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [['total_revenue', 'total']],
    raw: true
  });

  let prevRevenue = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: normalizeMonth(prevClosedStart) },
    attributes: [['total_revenue', 'total']],
    raw: true
  });

  if (!currentMonthRevenue) {
    currentMonthRevenue = await FinancialTransaction.findOne({
      where: {
        companyId,
        type: 'REVENUE',
        date: {
          [Sequelize.Op.gte]: latestClosedStart,
          [Sequelize.Op.lt]: rangeEndExclusive
        }
      },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
  }

  if (!prevRevenue) {
    prevRevenue = await FinancialTransaction.findOne({
      where: {
        companyId,
        type: 'REVENUE',
        date: {
          [Sequelize.Op.gte]: prevClosedStart,
          [Sequelize.Op.lt]: latestClosedStart
        }
      },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
  }

  const periodTotal = parseFloat(totalRevenue?.total || 0);
  const currentTotal = parseFloat(currentMonthRevenue?.total || 0);
  const previousTotal = parseFloat(prevRevenue?.total || 0);
  const growthRate = previousTotal > 0
    ? ((currentTotal - previousTotal) / previousTotal) * 100
    : 0;

  return {
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

  // Monthly expense trend (3 closed months)
  const monthlyExpenses = summaryRows.length > 0
    ? summaryRows.map(row => ({
      month: row.month,
      total: parseFloat(row.total_expenses || 0)
    }))
    : await FinancialTransaction.findAll({
      where: {
        companyId,
        type: 'EXPENSE',
        date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'month'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'ASC']],
      raw: true
    });

  // Expenses by category
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
  if (expensesByCategory.length === 0) {
    expensesByCategory = await FinancialTransaction.findAll({
      where: {
        companyId,
        type: 'EXPENSE',
        date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [
        'category',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: ['category'],
      order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
      raw: true
    });
  }

  // Total expenses (latest closed month only)
  let totalExpenses = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestClosedKey },
    attributes: [['total_expenses', 'total']],
    raw: true
  });
  if (!totalExpenses) {
    totalExpenses = await FinancialTransaction.findOne({
      where: {
        companyId,
        type: 'EXPENSE',
        date: { [Sequelize.Op.gte]: latestClosedStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
  }

  // Top expenses
  const topExpenses = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'EXPENSE',
      date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
    },
    attributes: ['category', 'description', 'amount', 'date'],
    order: [['amount', 'DESC']],
    limit: 10,
    raw: true
  });

  return {
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

  // Format monthly data from snapshots (fallback to transactions if empty)
  const monthlyMap = {};
  if (summaryRows.length > 0) {
    summaryRows.forEach((row) => {
      const monthKey = row.month;
      if (!monthKey) return;
      monthlyMap[monthKey] = {
        inflow: parseFloat(row.total_revenue || 0),
        outflow: parseFloat(row.total_expenses || 0)
      };
    });
  } else {
    const cashflowData = await FinancialTransaction.findAll({
      where: {
        companyId,
        date: { [Sequelize.Op.gte]: rangeStart, [Sequelize.Op.lt]: rangeEndExclusive }
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'month'],
        'type',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'type'],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'ASC']],
      raw: true
    });

    cashflowData.forEach((row) => {
      const monthKey = normalizeMonth(row.month);
      if (!monthKey) return;
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { inflow: 0, outflow: 0 };
      }
      if (row.type === 'REVENUE') {
        monthlyMap[monthKey].inflow += parseFloat(row.total || 0);
      }
      if (row.type === 'EXPENSE') {
        monthlyMap[monthKey].outflow += parseFloat(row.total || 0);
      }
    });
  }

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
