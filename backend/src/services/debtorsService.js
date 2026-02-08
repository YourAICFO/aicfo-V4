const { Sequelize } = require('sequelize');
const { MonthlyDebtor, MonthlyTrialBalanceSummary } = require('../models');
const { getLatestClosedMonthKey, listMonthKeysBetween } = require('./monthlySnapshotService');

const getLatestMonthKey = () => getLatestClosedMonthKey();

const getTotalByMonth = async (companyId, months) => {
  const rows = await MonthlyDebtor.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.in]: months }
    },
    attributes: [
      'month',
      [Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']
    ],
    group: ['month'],
    raw: true
  });
  const map = new Map(rows.map(r => [r.month, Number(r.total || 0)]));
  return months.map(m => ({ month: m, total: map.get(m) || 0 }));
};

const getSummary = async (companyId) => {
  const latestMonth = getLatestMonthKey();
  if (!latestMonth) {
    return { month: null, totalBalance: 0 };
  }

  const rows = await MonthlyDebtor.findAll({
    where: { companyId, month: latestMonth },
    order: [['closing_balance', 'DESC']],
    raw: true
  });

  if (rows.length === 0) {
    return { month: latestMonth, totalBalance: 0 };
  }

  const totalBalance = Number(rows[0].total_debtors_balance || 0);
  const top1 = rows[0]?.closing_balance ? Number(rows[0].closing_balance) : 0;
  const top5 = rows.slice(0, 5).reduce((sum, r) => sum + Number(r.closing_balance || 0), 0);
  const concentrationRatio = totalBalance > 0 ? top5 / totalBalance : 0;

  const prevMonthKey = listMonthKeysBetween(latestMonth, latestMonth).length
    ? listMonthKeysBetween(latestMonth, latestMonth)[0]
    : latestMonth;

  const revenueRow = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestMonth },
    raw: true
  });
  const prevRevenueRow = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: addMonths(latestMonth, -1) },
    raw: true
  });

  const revenue = Number(revenueRow?.total_revenue || 0);
  const prevRevenue = Number(prevRevenueRow?.total_revenue || 0);
  const revenueGrowth = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue : 0;

  const prevTotalRow = await MonthlyDebtor.findOne({
    where: { companyId, month: addMonths(latestMonth, -1) },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
    raw: true
  });
  const prevTotal = Number(prevTotalRow?.total || 0);
  const debtorGrowth = prevTotal > 0 ? (totalBalance - prevTotal) / prevTotal : 0;

  const divergenceFlag = debtorGrowth - revenueGrowth > 0.1;

  return {
    month: latestMonth,
    totalBalance,
    top1Balance: top1,
    top5Balance: top5,
    concentrationRatio,
    revenueGrowth,
    debtorGrowth,
    divergenceFlag
  };
};

const getTop = async (companyId) => {
  const latestMonth = getLatestMonthKey();
  if (!latestMonth) return [];
  return MonthlyDebtor.findAll({
    where: { companyId, month: latestMonth },
    order: [['closing_balance', 'DESC']],
    limit: 10,
    raw: true
  });
};

const getTrends = async (companyId) => {
  const latestMonth = getLatestMonthKey();
  if (!latestMonth) return { months: [] };
  const startKey = addMonths(latestMonth, -11);
  const months = listMonthKeysBetween(startKey, latestMonth);
  const totals = await getTotalByMonth(companyId, months);
  return { months: totals };
};

const addMonths = (monthKey, delta) => {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

module.exports = {
  getSummary,
  getTop,
  getTrends
};
