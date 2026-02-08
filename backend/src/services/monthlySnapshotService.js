const { Sequelize } = require('sequelize');
const {
  FinancialTransaction,
  CashBalance,
  AccountingMonth,
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  MonthlyDebtorsSnapshot,
  MonthlyCreditorsSnapshot,
  AccountingTermMapping,
  sequelize
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

const getLatestClosedMonthKey = (now = new Date()) => {
  const latestClosedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return normalizeMonth(latestClosedStart);
};

const addMonths = (monthKey, delta) => {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return normalizeMonth(d);
};

const listMonthKeysBetween = (startKey, endKey) => {
  const keys = [];
  if (!startKey || !endKey) return keys;
  let cursor = startKey;
  while (cursor && cursor <= endKey) {
    keys.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return keys;
};

const ensureAccountingMonth = async (companyId, monthKey, isClosed, sourceLastSyncedAt, transaction) => {
  const [record] = await AccountingMonth.findOrCreate({
    where: { companyId, month: monthKey },
    defaults: {
      companyId,
      month: monthKey,
      isClosed,
      sourceLastSyncedAt: sourceLastSyncedAt || null
    },
    transaction
  });
  if (record && (record.isClosed !== isClosed || sourceLastSyncedAt)) {
    await record.update({
      isClosed,
      sourceLastSyncedAt: sourceLastSyncedAt || record.sourceLastSyncedAt
    }, { transaction });
  }
};

const resolveTermMapping = async (sourceSystem, sourceTerm, normalizedType, transaction) => {
  const existing = await AccountingTermMapping.findOne({
    where: { sourceSystem, sourceTerm },
    transaction
  });
  if (existing) return existing;

  return AccountingTermMapping.create({
    sourceSystem,
    sourceTerm,
    normalizedTerm: sourceTerm,
    normalizedType
  }, { transaction });
};

const buildSnapshotForMonth = async (companyId, monthKey, transaction) => {
  const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
  const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const totals = await FinancialTransaction.findAll({
    where: {
      companyId,
      date: { [Sequelize.Op.gte]: monthStart, [Sequelize.Op.lt]: nextMonthStart }
    },
    attributes: [
      'type',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['type'],
    raw: true,
    transaction
  });

  const revenue = parseFloat(totals.find(t => t.type === 'REVENUE')?.total || 0);
  const expenses = parseFloat(totals.find(t => t.type === 'EXPENSE')?.total || 0);
  const netProfit = revenue - expenses;

  const latestCash = await CashBalance.findOne({
    where: {
      companyId,
      date: { [Sequelize.Op.gte]: monthStart, [Sequelize.Op.lt]: nextMonthStart }
    },
    order: [['date', 'DESC']],
    transaction
  });
  const cashAndBank = latestCash ? parseFloat(latestCash.amount) : 0;

  await MonthlyTrialBalanceSummary.upsert({
    companyId,
    month: monthKey,
    cashAndBankBalance: cashAndBank,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalRevenue: revenue,
    totalExpenses: expenses,
    netProfit,
    netCashflow: netProfit
  }, { transaction });

  await MonthlyRevenueBreakdown.destroy({ where: { companyId, month: monthKey }, transaction });
  await MonthlyExpenseBreakdown.destroy({ where: { companyId, month: monthKey }, transaction });
  await MonthlyDebtorsSnapshot.destroy({ where: { companyId, month: monthKey }, transaction });
  await MonthlyCreditorsSnapshot.destroy({ where: { companyId, month: monthKey }, transaction });

  const revenueByName = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'REVENUE',
      date: { [Sequelize.Op.gte]: monthStart, [Sequelize.Op.lt]: nextMonthStart }
    },
    attributes: [
      'category',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['category'],
    raw: true,
    transaction
  });

  for (const row of revenueByName) {
    const term = await resolveTermMapping('INTEGRATION', row.category || 'Revenue', 'REVENUE', transaction);
    await MonthlyRevenueBreakdown.create({
      companyId,
      month: monthKey,
      revenueName: row.category || term.normalizedTerm,
      normalizedRevenueCategory: term.normalizedTerm,
      amount: parseFloat(row.total || 0)
    }, { transaction });
  }

  const expenseByName = await FinancialTransaction.findAll({
    where: {
      companyId,
      type: 'EXPENSE',
      date: { [Sequelize.Op.gte]: monthStart, [Sequelize.Op.lt]: nextMonthStart }
    },
    attributes: [
      'category',
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['category'],
    raw: true,
    transaction
  });

  for (const row of expenseByName) {
    const term = await resolveTermMapping('INTEGRATION', row.category || 'Expense', 'EXPENSE', transaction);
    await MonthlyExpenseBreakdown.create({
      companyId,
      month: monthKey,
      expenseName: row.category || term.normalizedTerm,
      normalizedExpenseCategory: term.normalizedTerm,
      amount: parseFloat(row.total || 0)
    }, { transaction });
  }
};

const recomputeSnapshots = async (companyId, amendedMonthKey = null, sourceLastSyncedAt = null) => {
  const latestClosedKey = getLatestClosedMonthKey();
  if (!latestClosedKey) return { months: 0 };

  const startKey = amendedMonthKey || addMonths(latestClosedKey, -2);
  const monthKeys = listMonthKeysBetween(startKey, latestClosedKey);

  await sequelize.transaction(async (transaction) => {
    for (const monthKey of monthKeys) {
      const isClosed = monthKey <= latestClosedKey;
      await ensureAccountingMonth(companyId, monthKey, isClosed, sourceLastSyncedAt, transaction);
      await buildSnapshotForMonth(companyId, monthKey, transaction);
    }
  });

  return { months: monthKeys.length };
};

module.exports = {
  normalizeMonth,
  getLatestClosedMonthKey,
  listMonthKeysBetween,
  recomputeSnapshots
};
