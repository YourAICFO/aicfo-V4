const { Sequelize } = require('sequelize');
const { LedgerMonthlyBalance, sequelize } = require('../models');
const { getLatestClosedMonthKey, normalizeMonth } = require('./monthlySnapshotService');

const getCurrentMonthKey = () => normalizeMonth(new Date());

const computeConcentration = (rows, totalBalance) => {
  const sorted = [...rows].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
  const top1 = sorted.slice(0, 1).reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const top5 = sorted.slice(0, 5).reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const divisor = totalBalance || 1;
  return {
    top1Pct: (top1 / divisor) * 100,
    top5Pct: (top5 / divisor) * 100
  };
};

const computeRisk = (concentration) => {
  const reasons = [];
  if (concentration.top1Pct > 30) reasons.push('Top 1 exceeds 30%');
  if (concentration.top5Pct > 60) reasons.push('Top 5 exceeds 60%');

  if (concentration.top1Pct > 30 || concentration.top5Pct > 60) {
    return { level: 'high', reasons };
  }
  if (concentration.top1Pct > 20 || concentration.top5Pct > 45) {
    return { level: 'medium', reasons };
  }
  return { level: 'low', reasons: [] };
};

const getLatestAsOfDate = async (companyId, category, monthKey) => {
  const rows = await sequelize.query(
    `SELECT MAX(as_of_date) AS as_of_date
     FROM ledger_monthly_balances
     WHERE company_id = :companyId AND cfo_category = :category AND month_key = :monthKey`,
    {
      replacements: { companyId, category, monthKey },
      type: Sequelize.QueryTypes.SELECT
    }
  );
  return rows?.[0]?.as_of_date || null;
};

const getBalances = async (companyId, category, monthKey, asOfDate = null, limit = 10) => {
  const where = {
    companyId,
    cfoCategory: category,
    monthKey
  };
  if (asOfDate) {
    where.asOfDate = asOfDate;
  }

  const totalRow = await LedgerMonthlyBalance.findAll({
    where,
    attributes: [[Sequelize.fn('SUM', Sequelize.col('balance')), 'total']],
    raw: true
  });
  const totalBalance = Number(totalRow?.[0]?.total || 0);

  const topRows = await LedgerMonthlyBalance.findAll({
    where,
    order: [['balance', 'DESC']],
    limit,
    raw: true
  });

  return { totalBalance, rows: topRows };
};

const getSummary = async (companyId, category) => {
  const currentMonthKey = getCurrentMonthKey();
  const latestClosedKey = getLatestClosedMonthKey();
  const asOfDate = await getLatestAsOfDate(companyId, category, currentMonthKey);

  let currentMonthToUse = currentMonthKey;
  let currentAsOf = asOfDate;

  const currentCheck = await LedgerMonthlyBalance.count({
    where: { companyId, cfoCategory: category, monthKey: currentMonthKey }
  });

  if (!currentCheck) {
    currentMonthToUse = latestClosedKey;
    currentAsOf = null;
  }

  const current = await getBalances(companyId, category, currentMonthToUse, currentAsOf, 10);
  const prevClosed = latestClosedKey ? await getBalances(companyId, category, latestClosedKey, null, 10) : { totalBalance: 0, rows: [] };

  const changeAmount = Number(current.totalBalance || 0) - Number(prevClosed.totalBalance || 0);
  const changePct = prevClosed.totalBalance ? (changeAmount / Number(prevClosed.totalBalance)) * 100 : null;
  const direction = changeAmount > 0 ? 'up' : changeAmount < 0 ? 'down' : 'flat';

  const top10 = current.rows.map((row) => ({
    name: row.ledger_name,
    guid: row.ledger_guid,
    balance: Number(row.balance || 0),
    sharePct: current.totalBalance ? (Number(row.balance || 0) / current.totalBalance) * 100 : 0
  }));

  const concentration = computeConcentration(current.rows, current.totalBalance);
  const risk = computeRisk(concentration);

  return {
    asOf: currentAsOf || null,
    totalBalance: Number(current.totalBalance || 0),
    top10,
    concentration,
    changeVsPrevClosed: {
      amount: changeAmount,
      pct: changePct,
      direction
    },
    risk
  };
};

const getDebtorsSummary = (companyId) => getSummary(companyId, 'debtors');
const getCreditorsSummary = (companyId) => getSummary(companyId, 'creditors');

module.exports = {
  getDebtorsSummary,
  getCreditorsSummary,
  computeConcentration,
  computeRisk
};
