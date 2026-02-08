const { Sequelize } = require('sequelize');
const { FinancialTransaction, CashBalance, AIInsight } = require('../models');

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

const getCFOOverview = async (companyId) => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
  const currentCash = opening + revenue - expenses;

  // Get monthly inflows and outflows for last 6 months
  const monthlyData = await FinancialTransaction.findAll({
    where: {
      companyId,
      date: { [Sequelize.Op.gte]: threeMonthsAgo }
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

  for (let i = 0; i < 3; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = month.toISOString().slice(0, 7);

    const inflow = monthlyData.find(
      d => normalizeMonth(d.month) === monthStr && d.type === 'REVENUE'
    );
    const outflow = monthlyData.find(
      d => normalizeMonth(d.month) === monthStr && d.type === 'EXPENSE'
    );

    monthlyInflows.push(inflow ? parseFloat(inflow.total) : 0);
    monthlyOutflows.push(outflow ? parseFloat(outflow.total) : 0);
  }

  const avgMonthlyInflow = monthlyInflows.reduce((a, b) => a + b, 0) / 3;
  const avgMonthlyOutflow = monthlyOutflows.reduce((a, b) => a + b, 0) / 3;
  const netCashFlow = avgMonthlyInflow - avgMonthlyOutflow;

  // Calculate runway
  let runwayMonths = 0;
  let runwayStatus = 'RED';

  const cashBase = currentCash + bankBalance;
  const runwayDenominator = avgMonthlyOutflow > 0 && avgMonthlyInflow > 0
    ? (avgMonthlyInflow / avgMonthlyOutflow)
    : 0;

  if (runwayDenominator <= 0) {
    runwayMonths = 0;
    runwayStatus = 'RED';
  } else {
    runwayMonths = cashBase / runwayDenominator;
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
    insights: {
      recent: recentInsights,
      unreadCount
    }
  };
};

const getRevenueDashboard = async (companyId, period = '6m') => {
  const now = new Date();
  let startDate;

  switch (period) {
    case '1m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '12m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      break;
    case '6m':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  // Monthly revenue trend
  const monthlyRevenue = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'REVENUE',
      date: { [Sequelize.Op.gte]: startDate }
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
  const revenueByCategory = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'REVENUE',
      date: { [Sequelize.Op.gte]: startDate }
    },
    attributes: [
      'category',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['category'],
    order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
    raw: true
  });

  // Total revenue (current period)
  const totalRevenue = await FinancialTransaction.findOne({
    where: {
      companyId,
      type: 'REVENUE',
      date: { [Sequelize.Op.gte]: startDate }
    },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
    raw: true
  });

  // Latest month vs previous month growth
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const currentMonthRevenue = await FinancialTransaction.findOne({
    where: {
      companyId,
      type: 'REVENUE',
      date: {
        [Sequelize.Op.gte]: currentMonthStart,
        [Sequelize.Op.lt]: nextMonthStart
      }
    },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
    raw: true
  });

  const prevRevenue = await FinancialTransaction.findOne({
    where: {
      companyId,
      type: 'REVENUE',
      date: {
        [Sequelize.Op.gte]: prevMonthStart,
        [Sequelize.Op.lt]: currentMonthStart
      }
    },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
    raw: true
  });

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
      category: c.category,
      amount: parseFloat(c.total)
    }))
  };
};

const getExpenseDashboard = async (companyId, period = '6m') => {
  const now = new Date();
  let startDate;

  switch (period) {
    case '1m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '12m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      break;
    case '6m':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  // Monthly expense trend
  const monthlyExpenses = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'EXPENSE',
      date: { [Sequelize.Op.gte]: startDate }
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
  const expensesByCategory = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'EXPENSE',
      date: { [Sequelize.Op.gte]: startDate }
    },
    attributes: [
      'category',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['category'],
    order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
    raw: true
  });

  // Total expenses
  const totalExpenses = await FinancialTransaction.findOne({
    where: {
      companyId,
      type: 'EXPENSE',
      date: { [Sequelize.Op.gte]: startDate }
    },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
    raw: true
  });

  // Top expenses
  const topExpenses = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'EXPENSE',
      date: { [Sequelize.Op.gte]: startDate }
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
      category: c.category,
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

const getCashflowDashboard = async (companyId, period = '6m') => {
  const now = new Date();
  let startDate;

  switch (period) {
    case '1m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '12m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      break;
    case '6m':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  // Get monthly cashflow data
  const cashflowData = await FinancialTransaction.findAll({
    where: {
      companyId,
      date: { [Sequelize.Op.gte]: startDate }
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

  // Format monthly data (normalize month key to avoid Date object identity issues)
  const monthlyMap = {};
  cashflowData.forEach((row) => {
    const monthKey = normalizeMonth(row.month);
    if (!monthKey) {
      return;
    }
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
      date: { [Sequelize.Op.gte]: startDate }
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
