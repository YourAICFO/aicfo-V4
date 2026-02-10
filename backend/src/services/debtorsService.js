const { Sequelize } = require('sequelize');
const { MonthlyDebtor, MonthlyTrialBalanceSummary, CurrentDebtor } = require('../models');
const { getLatestClosedMonthKey } = require('./monthlySnapshotService');
const { listMonthKeysBetween, getMonthKeyOffset } = require('../utils/monthKeyUtils');

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

  const currentRows = await CurrentDebtor.findAll({
    where: { companyId },
    order: [['balance', 'DESC']],
    raw: true
  });
  if (currentRows.length === 0) {
    return { month: latestMonth, totalBalance: 0 };
  }
  const totalBalance = currentRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const top1 = currentRows[0]?.balance ? Number(currentRows[0].balance) : 0;
  const top5 = currentRows.slice(0, 5).reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const concentrationRatio = totalBalance > 0 ? top5 / totalBalance : 0;

  const prevMonthKey = listMonthKeysBetween(latestMonth, latestMonth).length
    ? listMonthKeysBetween(latestMonth, latestMonth)[0]
    : latestMonth;

  const revenueRow = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: latestMonth },
    raw: true
  });
  const prevRevenueRow = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId, month: getMonthKeyOffset(latestMonth, -1) },
    raw: true
  });

  const revenue = Number(revenueRow?.total_revenue || 0);
  const prevRevenue = Number(prevRevenueRow?.total_revenue || 0);
  const revenueGrowth = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue : 0;

  const prevTotalRow = await MonthlyDebtor.findOne({
    where: { companyId, month: getMonthKeyOffset(latestMonth, -1) },
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
  const rows = await CurrentDebtor.findAll({
    where: { companyId },
    order: [['balance', 'DESC']],
    limit: 10,
    raw: true
  });
  return rows;
};

const getTrends = async (companyId) => {
  const latestMonth = getLatestMonthKey();
  if (!latestMonth) return { months: [] };
  const startKey = getMonthKeyOffset(latestMonth, -11);
  const months = listMonthKeysBetween(startKey, latestMonth);
  const totals = await getTotalByMonth(companyId, months);
  return { months: totals };
};

module.exports = {
  getSummary,
  getTop,
  getTrends
};
