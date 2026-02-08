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
  MonthlyDebtor,
  MonthlyCreditor,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CurrentLiquidityMetric,
  CFOAlert,
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

const DEFAULT_TERM_MAP = {
  'sales': { term: 'Revenue', type: 'REVENUE' },
  'income': { term: 'Revenue', type: 'REVENUE' },
  'turnover': { term: 'Revenue', type: 'REVENUE' },
  'sundry debtors': { term: 'Debtors', type: 'ASSET' },
  'trade receivables': { term: 'Debtors', type: 'ASSET' },
  'accounts receivable': { term: 'Debtors', type: 'ASSET' },
  'sundry creditors': { term: 'Creditors', type: 'LIABILITY' },
  'trade payables': { term: 'Creditors', type: 'LIABILITY' },
  'accounts payable': { term: 'Creditors', type: 'LIABILITY' }
};

const resolveTermMapping = async (sourceSystem, sourceTerm, normalizedType, transaction) => {
  const existing = await AccountingTermMapping.findOne({
    where: { sourceSystem, sourceTerm },
    transaction
  });
  if (existing) return existing;

  const fallback = DEFAULT_TERM_MAP[(sourceTerm || '').toLowerCase()];
  return AccountingTermMapping.create({
    sourceSystem,
    sourceTerm,
    normalizedTerm: fallback?.term || sourceTerm,
    normalizedType: fallback?.type || normalizedType
  }, { transaction });
};

const computeTrendFlag = (momChange) => {
  if (momChange > 0.01) return 'UP';
  if (momChange < -0.01) return 'DOWN';
  return 'STABLE';
};

const computeAveragesForEntity = async (Model, companyId, nameField, nameValue, monthKey, transaction) => {
  const rows = await Model.findAll({
    where: {
      companyId,
      [nameField]: nameValue,
      month: { [Sequelize.Op.lte]: monthKey }
    },
    order: [['month', 'DESC']],
    limit: 12,
    raw: true,
    transaction
  });
  const values = rows.map(r => parseFloat(r.closing_balance || r.closingBalance || 0));
  const avg = (n) => {
    if (values.length === 0) return 0;
    const slice = values.slice(0, Math.min(n, values.length));
    const total = slice.reduce((a, b) => a + b, 0);
    return total / slice.length;
  };
  return {
    avg3m: avg(3),
    avg6m: avg(6),
    avg12m: avg(12)
  };
};

const upsertDebtorsCreditors = async (companyId, monthKey, debtors, creditors, transaction) => {
  if (Array.isArray(debtors)) {
    await MonthlyDebtor.destroy({ where: { companyId, month: monthKey }, transaction });
    const total = debtors.reduce((sum, d) => sum + Number(d.closing_balance || 0), 0);
    const sorted = [...debtors].sort((a, b) => Number(b.closing_balance || 0) - Number(a.closing_balance || 0));
    const topN = sorted.slice(0, 5);
    const topShare = topN.reduce((sum, d) => sum + Number(d.closing_balance || 0), 0) / (total || 1);
    const concentrationFlag = topShare >= 0.6;

    for (const debtor of debtors) {
      const name = debtor.debtor_name;
      await resolveTermMapping('INTEGRATION', name, 'ASSET', transaction);
      const closing = Number(debtor.closing_balance || 0);
      const prev = await MonthlyDebtor.findOne({
        where: { companyId, debtorName: name, month: addMonths(monthKey, -1) },
        raw: true,
        transaction
      });
      const prevVal = prev ? Number(prev.closing_balance || 0) : 0;
      const momChange = prevVal === 0 ? 0 : (closing - prevVal) / prevVal;
      const averages = await computeAveragesForEntity(MonthlyDebtor, companyId, 'debtorName', name, monthKey, transaction);

      await MonthlyDebtor.create({
        companyId,
        month: monthKey,
        debtorName: name,
        closingBalance: closing,
        totalDebtorsBalance: total,
        percentageOfTotal: total > 0 ? closing / total : 0,
        momChange,
        avg3m: averages.avg3m,
        avg6m: averages.avg6m,
        avg12m: averages.avg12m,
        trendFlag: computeTrendFlag(momChange),
        concentrationFlag: concentrationFlag && topN.some(d => d.debtor_name === name)
      }, { transaction });
    }
  }

  if (Array.isArray(creditors)) {
    await MonthlyCreditor.destroy({ where: { companyId, month: monthKey }, transaction });
    const total = creditors.reduce((sum, d) => sum + Number(d.closing_balance || 0), 0);
    const sorted = [...creditors].sort((a, b) => Number(b.closing_balance || 0) - Number(a.closing_balance || 0));
    const topN = sorted.slice(0, 5);
    const topShare = topN.reduce((sum, d) => sum + Number(d.closing_balance || 0), 0) / (total || 1);
    const concentrationFlag = topShare >= 0.6;

    for (const creditor of creditors) {
      const name = creditor.creditor_name;
      await resolveTermMapping('INTEGRATION', name, 'LIABILITY', transaction);
      const closing = Number(creditor.closing_balance || 0);
      const prev = await MonthlyCreditor.findOne({
        where: { companyId, creditorName: name, month: addMonths(monthKey, -1) },
        raw: true,
        transaction
      });
      const prevVal = prev ? Number(prev.closing_balance || 0) : 0;
      const momChange = prevVal === 0 ? 0 : (closing - prevVal) / prevVal;
      const averages = await computeAveragesForEntity(MonthlyCreditor, companyId, 'creditorName', name, monthKey, transaction);

      await MonthlyCreditor.create({
        companyId,
        month: monthKey,
        creditorName: name,
        closingBalance: closing,
        totalCreditorsBalance: total,
        percentageOfTotal: total > 0 ? closing / total : 0,
        momChange,
        avg3m: averages.avg3m,
        avg6m: averages.avg6m,
        avg12m: averages.avg12m,
        trendFlag: computeTrendFlag(momChange),
        concentrationFlag: concentrationFlag && topN.some(d => d.creditor_name === name)
      }, { transaction });
    }
  }
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

const updateCurrentBalances = async (companyId, payload, transaction) => {
  if (!payload) return;
  const { cashBalances, debtors, creditors, loans } = payload;

  if (Array.isArray(cashBalances)) {
    await CurrentCashBalance.destroy({ where: { companyId }, transaction });
    for (const row of cashBalances) {
      await CurrentCashBalance.create({
        companyId,
        accountName: row.account_name,
        balance: Number(row.balance || 0)
      }, { transaction });
    }
  }

  if (Array.isArray(debtors)) {
    await CurrentDebtor.destroy({ where: { companyId }, transaction });
    for (const row of debtors) {
      await CurrentDebtor.create({
        companyId,
        debtorName: row.debtor_name,
        balance: Number(row.balance || 0)
      }, { transaction });
    }
  }

  if (Array.isArray(creditors)) {
    await CurrentCreditor.destroy({ where: { companyId }, transaction });
    for (const row of creditors) {
      await CurrentCreditor.create({
        companyId,
        creditorName: row.creditor_name,
        balance: Number(row.balance || 0)
      }, { transaction });
    }
  }

  if (Array.isArray(loans)) {
    await CurrentLoan.destroy({ where: { companyId }, transaction });
    for (const row of loans) {
      await CurrentLoan.create({
        companyId,
        loanName: row.loan_name,
        balance: Number(row.balance || 0)
      }, { transaction });
    }
  }
};

const computeLiquidityMetrics = async (companyId, transaction) => {
  const latestClosedKey = getLatestClosedMonthKey();
  if (!latestClosedKey) return null;

  const startKey = addMonths(latestClosedKey, -2);
  const monthKeys = listMonthKeysBetween(startKey, latestClosedKey);
  const summaryRows = await MonthlyTrialBalanceSummary.findAll({
    where: { companyId, month: { [Sequelize.Op.in]: monthKeys } },
    raw: true,
    transaction
  });
  const map = new Map(summaryRows.map(r => [r.month, r]));
  const values = monthKeys.map(m => map.get(m) || {});
  const avgRevenue = values.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / Math.max(values.length, 1);
  const avgExpenses = values.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / Math.max(values.length, 1);
  const avgNetCashOutflow = avgRevenue - avgExpenses;

  const currentCashRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true, transaction });
  const currentCash = currentCashRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);

  let runway = null;
  if (avgNetCashOutflow < 0) {
    runway = Math.abs(avgNetCashOutflow) > 0 ? currentCash / Math.abs(avgNetCashOutflow) : null;
  }

  await CurrentLiquidityMetric.upsert({
    companyId,
    avgNetCashOutflow3m: avgNetCashOutflow,
    cashRunwayMonths: runway
  }, { transaction });

  return { avgNetCashOutflow, runway };
};

const upsertAlerts = async (companyId, transaction) => {
  const latestClosedKey = getLatestClosedMonthKey();
  if (!latestClosedKey) return;
  const prevKey = addMonths(latestClosedKey, -1);

  const latest = await MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: latestClosedKey }, raw: true, transaction });
  const prev = await MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: prevKey }, raw: true, transaction });
  const revenueGrowth = prev?.total_revenue ? (Number(latest?.total_revenue || 0) - Number(prev.total_revenue || 0)) / Number(prev.total_revenue || 1) : 0;
  const expenseGrowth = prev?.total_expenses ? (Number(latest?.total_expenses || 0) - Number(prev.total_expenses || 0)) / Number(prev.total_expenses || 1) : 0;

  const debtorsNow = await CurrentDebtor.findAll({ where: { companyId }, raw: true, transaction });
  const creditorsNow = await CurrentCreditor.findAll({ where: { companyId }, raw: true, transaction });
  const cashNow = await CurrentCashBalance.findAll({ where: { companyId }, raw: true, transaction });
  const cashTotal = cashNow.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const creditorsTotal = creditorsNow.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const debtorsTotal = debtorsNow.reduce((sum, r) => sum + Number(r.balance || 0), 0);

  const topDebtorShare = (() => {
    const sorted = [...debtorsNow].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
    const top = sorted.slice(0, 2).reduce((sum, r) => sum + Number(r.balance || 0), 0);
    return debtorsTotal > 0 ? top / debtorsTotal : 0;
  })();

  const alerts = [];
  if (debtorsTotal > 0 && Math.abs(revenueGrowth) < 0.02) {
    alerts.push({ alertType: 'DEBTORS_UP_REVENUE_FLAT', severity: 'AMBER', metadata: { revenueGrowth, debtorsTotal } });
  }
  if (expenseGrowth > 0.1 && cashTotal < 0) {
    alerts.push({ alertType: 'CASH_DECLINE_EXPENSES_UP', severity: 'RED', metadata: { expenseGrowth, cashTotal } });
  }
  if (topDebtorShare > 0.5) {
    alerts.push({ alertType: 'DEBTOR_CONCENTRATION', severity: 'AMBER', metadata: { topDebtorShare } });
  }
  if (creditorsTotal > 0 && expenseGrowth < 0.02) {
    alerts.push({ alertType: 'CREDITORS_UP_EXPENSES_FLAT', severity: 'AMBER', metadata: { creditorsTotal, expenseGrowth } });
  }

  await CFOAlert.destroy({ where: { companyId }, transaction });
  for (const alert of alerts) {
    await CFOAlert.create({ companyId, ...alert }, { transaction });
  }
};

const recomputeSnapshots = async (companyId, amendedMonthKey = null, sourceLastSyncedAt = null, debtors = null, creditors = null, currentBalances = null) => {
  const latestClosedKey = getLatestClosedMonthKey();
  if (!latestClosedKey) return { months: 0 };

  const startKey = amendedMonthKey || addMonths(latestClosedKey, -2);
  const monthKeys = listMonthKeysBetween(startKey, latestClosedKey);

  const debtorsByMonth = Array.isArray(debtors) ? { [amendedMonthKey]: debtors } : debtors;
  const creditorsByMonth = Array.isArray(creditors) ? { [amendedMonthKey]: creditors } : creditors;

  await sequelize.transaction(async (transaction) => {
    for (const monthKey of monthKeys) {
      const isClosed = monthKey <= latestClosedKey;
      await ensureAccountingMonth(companyId, monthKey, isClosed, sourceLastSyncedAt, transaction);
      await buildSnapshotForMonth(companyId, monthKey, transaction);
      const monthDebtors = debtorsByMonth ? debtorsByMonth[monthKey] : null;
      const monthCreditors = creditorsByMonth ? creditorsByMonth[monthKey] : null;
      if (monthDebtors || monthCreditors) {
        await upsertDebtorsCreditors(companyId, monthKey, monthDebtors, monthCreditors, transaction);
      }
    }

    await updateCurrentBalances(companyId, currentBalances, transaction);
    await computeLiquidityMetrics(companyId, transaction);
    await upsertAlerts(companyId, transaction);
  });

  try {
    const { recomputeForCompany } = require('./cfoQuestionService');
    await recomputeForCompany(companyId);
  } catch (error) {
    console.warn('CFO question recompute failed:', error.message);
  }

  return { months: monthKeys.length };
};

module.exports = {
  normalizeMonth,
  getLatestClosedMonthKey,
  listMonthKeysBetween,
  recomputeSnapshots
};
