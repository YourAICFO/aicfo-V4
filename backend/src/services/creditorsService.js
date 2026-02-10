const { Sequelize } = require('sequelize');
const { MonthlyCreditor, MonthlyTrialBalanceSummary, CurrentCreditor, CurrentCashBalance } = require('../models');
const { getLatestClosedMonthKey } = require('./monthlySnapshotService');
const { listMonthKeysBetween, getMonthKeyOffset } = require('../utils/monthKeyUtils');

const getLatestMonthKey = () => getLatestClosedMonthKey();

const getTotalByMonth = async (companyId, months) => {
  const rows = await MonthlyCreditor.findAll({
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
  if (!latestMonth) return { month: null, totalBalance: 0 };

  const currentRows = await CurrentCreditor.findAll({
    where: { companyId },
    order: [['balance', 'DESC']],
    raw: true
  });
  if (currentRows.length === 0) return { month: latestMonth, totalBalance: 0 };

  const totalBalance = currentRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const top1 = currentRows[0]?.balance ? Number(currentRows[0].balance) : 0;
  const top5 = currentRows.slice(0, 5).reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const concentrationRatio = totalBalance > 0 ? top5 / totalBalance : 0;

  const cashRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true });
  const cashBalance = cashRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const cashPressure = totalBalance > cashBalance;

  return {
    month: latestMonth,
    totalBalance,
    top1Balance: top1,
    top5Balance: top5,
    concentrationRatio,
    cashPressure
  };
};

const getTop = async (companyId) => {
  const rows = await CurrentCreditor.findAll({
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
