const { Sequelize } = require('sequelize');
const {
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLiquidityMetric,
  CFOMetric,
  CFOAlert,
  MonthlyDebtor,
  MonthlyCreditor
} = require('../models');
const { getLatestClosedMonthKey, listMonthKeysBetween } = require('./monthlySnapshotService');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const addMonths = (monthKey, delta) => {
  if (!monthKey) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMetricValue = async (companyId, metricKey, timeScope, monthKey) => {
  const where = { companyId, metricKey };
  if (timeScope) where.timeScope = timeScope;
  if (monthKey) where.month = monthKey;
  const row = await CFOMetric.findOne({ where, raw: true });
  if (!row) return null;
  if (row.metric_value !== null && row.metric_value !== undefined) return Number(row.metric_value);
  if (row.metric_text !== null && row.metric_text !== undefined) return row.metric_text;
  return null;
};

const getCashLatest = async (companyId) => {
  const rows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true });
  return rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
};

const getTopParties = async (Model, companyId) => {
  const rows = await Model.findAll({ where: { companyId }, order: [['balance', 'DESC']], limit: 10, raw: true });
  const total = rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  return rows.map(r => ({
    name: r.debtorName || r.creditorName || r.debtor_name || r.creditor_name || r.name,
    balance: Number(r.balance || 0),
    share_percent: total > 0 ? (Number(r.balance || 0) / total) * 100 : 0
  }));
};

const getTopHeads = async (Model, companyId, monthKey, nameField, trendMonths) => {
  const rows = await Model.findAll({
    where: { companyId, month: monthKey },
    order: [['amount', 'DESC']],
    limit: 10,
    raw: true
  });

  const trendStart = addMonths(monthKey, -(trendMonths - 1));
  const trendKeys = listMonthKeysBetween(trendStart, monthKey);
  const trendRows = await Model.findAll({
    where: { companyId, month: { [Sequelize.Op.in]: trendKeys } },
    raw: true
  });

  const trendMap = new Map();
  trendRows.forEach((row) => {
    const key = row[nameField];
    if (!trendMap.has(key)) trendMap.set(key, []);
    trendMap.get(key).push(Number(row.amount || 0));
  });

  return rows.map((row) => {
    const key = row[nameField];
    const trend = trendMap.get(key) || [];
    const avg = trend.length ? trend.reduce((a, b) => a + b, 0) / trend.length : null;
    return {
      name: key,
      amount: Number(row.amount || 0),
      trend_6m_avg: avg
    };
  });
};

const buildContext = async (companyId) => {
  if (process.env.CFO_CONTEXT_ENABLED !== 'true') return null;

  const cached = cache.get(companyId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const latestClosed = getLatestClosedMonthKey();
  if (!latestClosed) return null;

  const startKey = addMonths(latestClosed, -23);
  const months = listMonthKeysBetween(startKey, latestClosed);

  const summaries = await MonthlyTrialBalanceSummary.findAll({
    where: { companyId, month: { [Sequelize.Op.in]: months } },
    order: [['month', 'ASC']],
    raw: true
  });

  const revenueTrend = summaries.map(row => ({ month: row.month, value: Number(row.total_revenue || 0) }));
  const expenseTrend = summaries.map(row => ({ month: row.month, value: Number(row.total_expenses || 0) }));
  const profitTrend = summaries.map(row => ({ month: row.month, value: Number(row.net_profit || 0) }));

  const topRevenueHeads = await getTopHeads(
    MonthlyRevenueBreakdown,
    companyId,
    latestClosed,
    'normalized_revenue_category',
    6
  );
  const topExpenseHeads = await getTopHeads(
    MonthlyExpenseBreakdown,
    companyId,
    latestClosed,
    'normalized_expense_category',
    6
  );

  const topDebtors = await getTopParties(CurrentDebtor, companyId);
  const topCreditors = await getTopParties(CurrentCreditor, companyId);

  const cashLatest = await getCashLatest(companyId);
  const runwayMonths = await getMetricValue(companyId, 'cash_runway_months', 'live', latestClosed);
  let receivableDays = await getMetricValue(companyId, 'debtor_days', '3m', latestClosed);
  let payableDays = await getMetricValue(companyId, 'creditor_days', '3m', latestClosed);

  if (receivableDays === null) {
    const debtorsTotal = await MonthlyDebtor.findOne({
      where: { companyId, month: latestClosed },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true
    });
    const revenueAvg = await getMetricValue(companyId, 'revenue_avg_3m', '3m', latestClosed);
    receivableDays = revenueAvg && revenueAvg > 0
      ? (Number(debtorsTotal?.total || 0) / Number(revenueAvg)) * 30
      : null;
  }

  if (payableDays === null) {
    const creditorsTotal = await MonthlyCreditor.findOne({
      where: { companyId, month: latestClosed },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true
    });
    const expenseAvg = await getMetricValue(companyId, 'expense_avg_3m', '3m', latestClosed);
    payableDays = expenseAvg && expenseAvg > 0
      ? (Number(creditorsTotal?.total || 0) / Number(expenseAvg)) * 30
      : null;
  }

  const alerts = await CFOAlert.findAll({ where: { companyId }, order: [['generated_at', 'DESC']], limit: 10, raw: true });

  const data = {
    companyId,
    latest_closed_month: latestClosed,
    months_used: months.length,
    revenue_trend: revenueTrend,
    expense_trend: expenseTrend,
    profit_trend: profitTrend,
    top_expense_heads: topExpenseHeads,
    top_revenue_heads: topRevenueHeads,
    top_debtors: topDebtors,
    top_creditors: topCreditors,
    cash_latest: cashLatest,
    runway_months: runwayMonths,
    receivable_days: receivableDays,
    payable_days: payableDays,
    alerts
  };

  cache.set(companyId, { timestamp: Date.now(), data });
  return data;
};

module.exports = {
  buildContext
};
