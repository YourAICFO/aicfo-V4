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
  LedgerMonthlyBalance,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CurrentLiquidityMetric,
  CFOAlert,
  CFOMetric,
  AccountingTermMapping,
  AdminUsageEvent,
  sequelize
} = require('../models');
const { normalizeAccountHead } = require('./accountHeadNormalizer');
const { mapLedgersToCFOTotals, upsertLedgerClassifications } = require('./cfoAccountMappingService');
const { validateChartOfAccountsPayload } = require('./coaPayloadValidator');
const { normalizeSourceLedger, upsertAccountingTermMapping } = require('./sourceNormalizationService');
const { logUsageEvent } = require('./adminUsageService');

const { normalizeMonth, listMonthKeysBetween, getMonthKeyOffset } = require('../utils/monthKeyUtils');
const addMonths = getMonthKeyOffset;

const getLatestClosedMonthKey = (now = new Date()) => {
  const latestClosedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return normalizeMonth(latestClosedStart);
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

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

// Sign normalization rules for balances-only fallback:
// - revenue/expense are reported as positive magnitudes in summaries/breakdowns
// - cash/bank keeps source sign (overdraft/negative cash should remain negative)
// - debtor/creditor/loan uses positive magnitudes for outstanding balances
const normalizeBalanceByKind = (value, kind) => {
  const amount = toNumber(value);
  switch (kind) {
    case 'revenue':
    case 'expense':
    case 'debtor':
    case 'creditor':
    case 'loan':
      return Math.abs(amount);
    case 'cash':
    default:
      return amount;
  }
};

const normalizeCategoryKey = (value) => (value || '').toString().trim().toLowerCase();

const isRevenueCategory = (category) => {
  const key = normalizeCategoryKey(category);
  return key.includes('revenue') || key.includes('income') || key === 'sales';
};

const isExpenseCategory = (category) => {
  const key = normalizeCategoryKey(category);
  return key.includes('expense') || key.includes('cogs') || key.includes('cost');
};

const isCashCategory = (row) => {
  const category = normalizeCategoryKey(row.cfoCategory);
  if (category === 'cash_bank' || category.includes('cash') || category.includes('bank')) {
    return true;
  }
  const group = normalizeCategoryKey(row.parentGroup);
  return group.includes('cash') || group.includes('bank');
};

const isDebtorCategory = (row) => {
  const category = normalizeCategoryKey(row.cfoCategory);
  if (category === 'debtors' || category === 'debtor' || category.includes('receivable')) {
    return true;
  }
  const group = normalizeCategoryKey(row.parentGroup);
  return group.includes('debtor') || group.includes('receivable');
};

const isCreditorCategory = (row) => {
  const category = normalizeCategoryKey(row.cfoCategory);
  if (category === 'creditors' || category === 'creditor' || category.includes('payable')) {
    return true;
  }
  const group = normalizeCategoryKey(row.parentGroup);
  return group.includes('creditor') || group.includes('payable');
};

const isLoanCategory = (row) => {
  const category = normalizeCategoryKey(row.cfoCategory);
  if (category.includes('loan') || category.includes('debt') || category.includes('interest')) {
    return true;
  }
  const group = normalizeCategoryKey(row.parentGroup);
  return group.includes('loan') || group.includes('debt') || group.includes('secured') || group.includes('unsecured');
};

const summarizeByLedgerName = (rows = [], kind = 'default') => {
  const grouped = new Map();
  for (const row of rows) {
    const name = row.ledgerName || row.ledger_name || 'Unknown';
    const amount = normalizeBalanceByKind(row.balance, kind);
    grouped.set(name, (grouped.get(name) || 0) + amount);
  }
  return Array.from(grouped.entries()).map(([name, total]) => ({ name, total }));
};

const deriveCurrentBalancesFromLedger = async (companyId, preferredMonthKey, transaction) => {
  let targetMonthKey = preferredMonthKey || null;

  if (targetMonthKey) {
    const count = await LedgerMonthlyBalance.count({
      where: { companyId, monthKey: targetMonthKey },
      transaction
    });
    if (count === 0) {
      targetMonthKey = null;
    }
  }

  if (!targetMonthKey) {
    const latest = await LedgerMonthlyBalance.findOne({
      where: { companyId },
      order: [['monthKey', 'DESC']],
      attributes: ['monthKey'],
      raw: true,
      transaction
    });
    targetMonthKey = latest?.monthKey || null;
  }

  if (!targetMonthKey) {
    return null;
  }

  const rows = await LedgerMonthlyBalance.findAll({
    where: { companyId, monthKey: targetMonthKey },
    raw: true,
    transaction
  });

  if (!rows.length) {
    return null;
  }

  const toPayloadRows = (items, keyName, kind) => summarizeByLedgerName(items, kind).map((item) => ({
    [keyName]: item.name,
    balance: item.total
  }));

  return {
    cashBalances: toPayloadRows(rows.filter(isCashCategory), 'account_name', 'cash'),
    debtors: toPayloadRows(rows.filter(isDebtorCategory), 'debtor_name', 'debtor'),
    creditors: toPayloadRows(rows.filter(isCreditorCategory), 'creditor_name', 'creditor'),
    loans: toPayloadRows(rows.filter(isLoanCategory), 'loan_name', 'loan')
  };
};

const logSnapshotComputationSource = async (companyId, monthKey, computedFrom, transaction) => {
  try {
    await AdminUsageEvent.create({
      companyId,
      userId: null,
      eventType: 'snapshot_computed_from',
      metadata: {
        monthKey,
        computedFrom
      }
    }, { transaction });
  } catch (error) {
    console.warn('Snapshot computation source log failed:', error.message);
  }
};

const logCurrentBalancesSource = async (companyId, monthKey, source, transaction) => {
  try {
    await AdminUsageEvent.create({
      companyId,
      userId: null,
      eventType: 'current_balances_source',
      metadata: {
        monthKey,
        source
      }
    }, { transaction });
  } catch (error) {
    console.warn('Current balances source log failed:', error.message);
  }
};

const resolveTermMapping = async (sourceSystem, sourceTerm, normalizedType, transaction) => {
  const sourceKey = String(sourceSystem || '').toLowerCase();
  const existing = await AccountingTermMapping.findOne({
    where: { sourceSystem: sourceKey, sourceTerm },
    transaction
  });
  if (existing) return existing;

  const normalized = await normalizeSourceLedger({
    sourceSystem,
    ledgerName: sourceTerm,
    groupName: sourceTerm,
    accountType: normalizedType,
    category: sourceTerm
  });
  const fallback = DEFAULT_TERM_MAP[(sourceTerm || '').toLowerCase()];
  return upsertAccountingTermMapping({
    sourceSystem: sourceKey,
    sourceTerm,
    normalizedType: normalized.normalizedType || fallback?.type || normalizedType,
    normalizedBucket: normalized.normalizedBucket || fallback?.term || sourceTerm,
    mappingRuleType: normalized.mappingRuleType || 'system_rule',
    confidenceScore: normalized.confidenceScore || 1.0,
    sourceRuleId: normalized.sourceRuleId || null
  }, transaction);
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

const computeYoYGrowth = (currentValue, lastYearValue) => {
  if (lastYearValue === null || lastYearValue === undefined) return null;
  const prev = Number(lastYearValue);
  if (!Number.isFinite(prev) || prev === 0) return null;
  const curr = Number(currentValue || 0);
  return (curr - prev) / Math.abs(prev);
};

const computeStdDev = (values) => {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const computeTrendDirection = (values) => {
  if (values.length < 2) return 0;
  const first = values[0];
  const last = values[values.length - 1];
  if (last > first) return 1;
  if (last < first) return -1;
  return 0;
};

const getRetentionWindow = (latestClosedKey) => {
  if (!latestClosedKey) return { oldestKeepKey: null, openMonthKey: null, keys: [] };
  const openMonthKey = addMonths(latestClosedKey, 1);
  const oldestKeepKey = addMonths(latestClosedKey, -23);
  const keys = listMonthKeysBetween(oldestKeepKey, openMonthKey);
  return { oldestKeepKey, openMonthKey, keys };
};

const trimOldSnapshots = async (companyId, latestClosedKey, transaction) => {
  const { oldestKeepKey } = getRetentionWindow(latestClosedKey);
  if (!oldestKeepKey) return;
  const whereOld = { companyId, month: { [Sequelize.Op.lt]: oldestKeepKey } };
  await MonthlyTrialBalanceSummary.destroy({ where: whereOld, transaction });
  await MonthlyRevenueBreakdown.destroy({ where: whereOld, transaction });
  await MonthlyExpenseBreakdown.destroy({ where: whereOld, transaction });
  await MonthlyDebtorsSnapshot.destroy({ where: whereOld, transaction });
  await MonthlyCreditorsSnapshot.destroy({ where: whereOld, transaction });
  await MonthlyDebtor.destroy({ where: whereOld, transaction });
  await MonthlyCreditor.destroy({ where: whereOld, transaction });
  await AccountingMonth.destroy({ where: whereOld, transaction });
  await CFOMetric.destroy({
    where: {
      companyId,
      month: { [Sequelize.Op.lt]: oldestKeepKey }
    },
    transaction
  });
};

const upsertMetric = async (companyId, metricKey, metricValue, timeScope, transaction, opts = {}) => {
  const normalizedScope = (timeScope || 'live').toLowerCase();
  const isMonthlyScope = normalizedScope === 'month';
  // Sanity contract: monthly scope keeps month-level history; non-month scope behaves as latest/current.
  const metricMonth = isMonthlyScope ? (opts.month || null) : null;

  if (isMonthlyScope && !metricMonth) {
    throw new Error(`month is required for monthly metric '${metricKey}'`);
  }

  const where = {
    companyId,
    metricKey,
    timeScope: normalizedScope,
    ...(isMonthlyScope ? { month: metricMonth } : {})
  };

  const payload = {
    companyId,
    metricKey,
    metricValue: metricValue === null || metricValue === undefined ? null : metricValue,
    metricText: metricValue === null || metricValue === undefined ? null : String(metricValue),
    timeScope: normalizedScope,
    month: metricMonth,
    changePct: opts.changePct ?? null,
    severity: opts.severity || null,
    computedAt: new Date(),
    updatedAt: new Date()
  };

  const existing = await CFOMetric.findOne({ where, transaction });
  if (existing) {
    await existing.update(payload, { transaction });
    return;
  }

  await CFOMetric.create(payload, { transaction });
};

const computeCfoMetrics = async (companyId, transaction) => {
  const latestClosedKey = getLatestClosedMonthKey();
  const currentCashRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true, transaction });
  const currentDebtors = await CurrentDebtor.findAll({ where: { companyId }, raw: true, transaction });
  const currentCreditors = await CurrentCreditor.findAll({ where: { companyId }, raw: true, transaction });
  const currentLoans = await CurrentLoan.findAll({ where: { companyId }, raw: true, transaction });

  const cashBalance = currentCashRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const debtorsBalance = currentDebtors.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const creditorsBalance = currentCreditors.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const loansBalance = currentLoans.reduce((sum, r) => sum + Number(r.balance || 0), 0);

  await upsertMetric(companyId, 'cash_balance_live', cashBalance, 'live', transaction);
  await upsertMetric(companyId, 'debtors_balance_live', debtorsBalance, 'live', transaction);
  await upsertMetric(companyId, 'creditors_balance_live', creditorsBalance, 'live', transaction);
  await upsertMetric(companyId, 'loans_balance_live', loansBalance, 'live', transaction);

  const liquidity = await CurrentLiquidityMetric.findOne({ where: { companyId }, raw: true, transaction });
  await upsertMetric(companyId, 'cash_runway_months', Number(liquidity?.cash_runway_months || 0), 'live', transaction, { month: latestClosedKey });
  await upsertMetric(companyId, 'avg_net_cash_outflow_3m', Number(liquidity?.avg_net_cash_outflow_3m || 0), '3m', transaction, { month: latestClosedKey });
  const prevRunway = latestClosedKey ? await CFOMetric.findOne({
    where: { companyId, metricKey: 'cash_runway_months', month: addMonths(latestClosedKey, -1) },
    raw: true,
    transaction
  }) : null;
  const runwayChange = prevRunway ? Number(liquidity?.cash_runway_months || 0) - Number(prevRunway.metric_value || 0) : null;
  await upsertMetric(companyId, 'cash_runway_change_mom', runwayChange, 'mom', transaction, { month: latestClosedKey });

  if (latestClosedKey) {
    const latestSummary = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month: latestClosedKey },
      raw: true,
      transaction
    });
    const prevClosedKey = addMonths(latestClosedKey, -1);
    const prevSummary = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month: prevClosedKey },
      raw: true,
      transaction
    });

    await upsertMetric(companyId, 'revenue_last_closed', Number(latestSummary?.total_revenue || 0), 'last_closed_month', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expenses_last_closed', Number(latestSummary?.total_expenses || 0), 'last_closed_month', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'net_profit_last_closed', Number(latestSummary?.net_profit || 0), 'last_closed_month', transaction, { month: latestClosedKey });

    const revenueMom = computeYoYGrowth(latestSummary?.total_revenue || 0, prevSummary?.total_revenue || 0);
    const expenseMom = computeYoYGrowth(latestSummary?.total_expenses || 0, prevSummary?.total_expenses || 0);
    await upsertMetric(companyId, 'revenue_mom_growth_pct', revenueMom, 'mom', transaction, { month: latestClosedKey, changePct: revenueMom !== null ? revenueMom * 100 : null });
    await upsertMetric(companyId, 'expense_mom_growth_pct', expenseMom, 'mom', transaction, { month: latestClosedKey, changePct: expenseMom !== null ? expenseMom * 100 : null });

    const recentKeys = listMonthKeysBetween(addMonths(latestClosedKey, -2), latestClosedKey);
    const prevKeys = listMonthKeysBetween(addMonths(latestClosedKey, -5), addMonths(latestClosedKey, -3));
    const sixKeys = listMonthKeysBetween(addMonths(latestClosedKey, -5), latestClosedKey);
    const twelveKeys = listMonthKeysBetween(addMonths(latestClosedKey, -11), latestClosedKey);

    const recentRows = await MonthlyTrialBalanceSummary.findAll({
      where: { companyId, month: { [Sequelize.Op.in]: recentKeys } },
      raw: true,
      transaction
    });
    const sixRows = await MonthlyTrialBalanceSummary.findAll({
      where: { companyId, month: { [Sequelize.Op.in]: sixKeys } },
      raw: true,
      transaction
    });
    const twelveRows = await MonthlyTrialBalanceSummary.findAll({
      where: { companyId, month: { [Sequelize.Op.in]: twelveKeys } },
      raw: true,
      transaction
    });
    const prevRows = await MonthlyTrialBalanceSummary.findAll({
      where: { companyId, month: { [Sequelize.Op.in]: prevKeys } },
      raw: true,
      transaction
    });
    const recentRevenueAvg = recentRows.length
      ? recentRows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / recentRows.length
      : 0;
    const sixRevenueAvg = sixRows.length
      ? sixRows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / sixRows.length
      : 0;
    const twelveRevenueAvg = twelveRows.length
      ? twelveRows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / twelveRows.length
      : 0;
    const prevRevenueAvg = prevRows.length
      ? prevRows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / prevRows.length
      : 0;
    const revenueGrowth3m = prevRevenueAvg === 0 ? 0 : (recentRevenueAvg - prevRevenueAvg) / prevRevenueAvg;

    const recentExpenseAvg = recentRows.length
      ? recentRows.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / recentRows.length
      : 0;
    const sixExpenseAvg = sixRows.length
      ? sixRows.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / sixRows.length
      : 0;
    const twelveExpenseAvg = twelveRows.length
      ? twelveRows.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / twelveRows.length
      : 0;

    const recentProfitAvg = recentRows.length
      ? recentRows.reduce((sum, r) => sum + Number(r.net_profit || 0), 0) / recentRows.length
      : 0;
    const sixProfitAvg = sixRows.length
      ? sixRows.reduce((sum, r) => sum + Number(r.net_profit || 0), 0) / sixRows.length
      : 0;
    const twelveProfitAvg = twelveRows.length
      ? twelveRows.reduce((sum, r) => sum + Number(r.net_profit || 0), 0) / twelveRows.length
      : 0;
    const prevExpenseAvg = prevRows.length
      ? prevRows.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / prevRows.length
      : 0;
    const expenseGrowth3m = prevExpenseAvg === 0 ? 0 : (recentExpenseAvg - prevExpenseAvg) / prevExpenseAvg;

    await upsertMetric(companyId, 'revenue_growth_3m', revenueGrowth3m, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expense_growth_3m', expenseGrowth3m, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expense_vs_revenue_growth_gap', expenseGrowth3m - revenueGrowth3m, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'revenue_avg_3m', recentRevenueAvg, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'revenue_avg_6m', sixRevenueAvg, '6m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'revenue_avg_12m', twelveRevenueAvg, '12m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expense_avg_3m', recentExpenseAvg, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expense_avg_6m', sixExpenseAvg, '6m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expense_avg_12m', twelveExpenseAvg, '12m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'net_profit_avg_3m', recentProfitAvg, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'net_profit_avg_6m', sixProfitAvg, '6m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'net_profit_avg_12m', twelveProfitAvg, '12m', transaction, { month: latestClosedKey });

    const revenueTrend = computeTrendDirection(recentRows.map(r => Number(r.total_revenue || 0)));
    const expenseTrend = computeTrendDirection(recentRows.map(r => Number(r.total_expenses || 0)));
    await upsertMetric(companyId, 'revenue_trend_direction', revenueTrend, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'expense_trend_direction', expenseTrend, '3m', transaction, { month: latestClosedKey });

    const revenueStd = computeStdDev(sixRows.map(r => Number(r.total_revenue || 0)));
    const revenueVolatility = sixRevenueAvg === 0 ? 0 : revenueStd / sixRevenueAvg;
    await upsertMetric(companyId, 'revenue_volatility', revenueVolatility, '6m', transaction, { month: latestClosedKey });

    const revenueStagnation = Math.abs(revenueGrowth3m) < 0.02 ? 1 : 0;
    await upsertMetric(companyId, 'revenue_stagnation_flag', revenueStagnation, '3m', transaction, { month: latestClosedKey });

    const lastYearKey = addMonths(latestClosedKey, -12);
    const lastYearSummary = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month: lastYearKey },
      raw: true,
      transaction
    });
    if (!lastYearSummary) {
      console.warn(`YoY metrics: no prior year month ${lastYearKey} for company ${companyId}`);
    }
    const revYoY = computeYoYGrowth(latestSummary?.total_revenue || 0, lastYearSummary?.total_revenue);
    const expYoY = computeYoYGrowth(latestSummary?.total_expenses || 0, lastYearSummary?.total_expenses);
    const profitYoY = computeYoYGrowth(latestSummary?.net_profit || 0, lastYearSummary?.net_profit);
    const currentMargin = Number(latestSummary?.total_revenue || 0) > 0
      ? Number(latestSummary?.net_profit || 0) / Number(latestSummary?.total_revenue || 0)
      : null;
    const lastYearMargin = Number(lastYearSummary?.total_revenue || 0) > 0
      ? Number(lastYearSummary?.net_profit || 0) / Number(lastYearSummary?.total_revenue || 0)
      : null;
    const marginYoY = computeYoYGrowth(currentMargin, lastYearMargin);
    const prevMargin = Number(prevSummary?.total_revenue || 0) > 0
      ? Number(prevSummary?.net_profit || 0) / Number(prevSummary?.total_revenue || 0)
      : null;
    const marginMom = computeYoYGrowth(currentMargin, prevMargin);
    await upsertMetric(companyId, 'net_margin_last_closed', currentMargin, 'last_closed_month', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'net_margin_mom_change', marginMom, 'mom', transaction, { month: latestClosedKey });

    await upsertMetric(companyId, 'revenue_yoy_growth_pct', revYoY, 'yoy', transaction, { month: latestClosedKey, changePct: revYoY !== null ? revYoY * 100 : null });
    await upsertMetric(companyId, 'expense_yoy_growth_pct', expYoY, 'yoy', transaction, { month: latestClosedKey, changePct: expYoY !== null ? expYoY * 100 : null });
    await upsertMetric(companyId, 'net_profit_yoy_growth_pct', profitYoY, 'yoy', transaction, { month: latestClosedKey, changePct: profitYoY !== null ? profitYoY * 100 : null });
    await upsertMetric(companyId, 'gross_margin_yoy_growth_pct', marginYoY, 'yoy', transaction, { month: latestClosedKey, changePct: marginYoY !== null ? marginYoY * 100 : null });

    const lastYearCash = Number(lastYearSummary?.cash_and_bank_balance || 0);
    const cashYoYChange = lastYearSummary ? cashBalance - lastYearCash : null;
    await upsertMetric(companyId, 'cash_balance_yoy_change', cashYoYChange, 'yoy', transaction, { month: latestClosedKey });

    const lastYearDebtorsTotal = await MonthlyDebtor.findOne({
      where: { companyId, month: lastYearKey },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true,
      transaction
    });
    const lastYearCreditorsTotal = await MonthlyCreditor.findOne({
      where: { companyId, month: lastYearKey },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true,
      transaction
    });
    const debtorsYoY = lastYearDebtorsTotal ? debtorsBalance - Number(lastYearDebtorsTotal.total || 0) : null;
    const creditorsYoY = lastYearCreditorsTotal ? creditorsBalance - Number(lastYearCreditorsTotal.total || 0) : null;
    await upsertMetric(companyId, 'debtor_balance_yoy_change', debtorsYoY, 'yoy', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'creditor_balance_yoy_change', creditorsYoY, 'yoy', transaction, { month: latestClosedKey });
  }

  const top5 = currentDebtors
    .slice(0, 5)
    .reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const concentrationRatio = debtorsBalance > 0 ? top5 / debtorsBalance : 0;
  await upsertMetric(companyId, 'debtors_concentration_ratio', concentrationRatio, 'live', transaction, { month: latestClosedKey });

  const creditorsTop5 = currentCreditors
    .slice(0, 5)
    .reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const creditorsConcentration = creditorsBalance > 0 ? creditorsTop5 / creditorsBalance : 0;
  await upsertMetric(companyId, 'creditors_concentration_ratio', creditorsConcentration, 'live', transaction, { month: latestClosedKey });

  const cashPressure = creditorsBalance > cashBalance;
  await upsertMetric(companyId, 'creditors_cash_pressure', cashPressure ? 1 : 0, 'live', transaction, { month: latestClosedKey });

  const workingCapital = cashBalance + debtorsBalance - creditorsBalance;
  await upsertMetric(companyId, 'working_capital', workingCapital, 'live', transaction, { month: latestClosedKey });

  const lastClosedKey = latestClosedKey;
  if (lastClosedKey) {
    const lastClosedDebtors = await MonthlyDebtor.findOne({
      where: { companyId, month: lastClosedKey },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true,
      transaction
    });
    const lastClosedCreditors = await MonthlyCreditor.findOne({
      where: { companyId, month: lastClosedKey },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true,
      transaction
    });
    const lastClosedDebtorTotal = Number(lastClosedDebtors?.total || 0);
    const lastClosedCreditorTotal = Number(lastClosedCreditors?.total || 0);

    const debtorDays = recentRevenueAvg > 0 ? (lastClosedDebtorTotal / recentRevenueAvg) * 30 : null;
    const creditorDays = recentExpenseAvg > 0 ? (lastClosedCreditorTotal / recentExpenseAvg) * 30 : null;
    await upsertMetric(companyId, 'debtor_days', debtorDays, '3m', transaction, { month: latestClosedKey });
    await upsertMetric(companyId, 'creditor_days', creditorDays, '3m', transaction, { month: latestClosedKey });
    const cashConversion = debtorDays !== null && creditorDays !== null ? debtorDays - creditorDays : null;
    await upsertMetric(companyId, 'cash_conversion_cycle', cashConversion, '3m', transaction, { month: latestClosedKey });

    const prevClosedKey = addMonths(latestClosedKey, -1);
    const prevDebtors = await MonthlyDebtor.findOne({
      where: { companyId, month: prevClosedKey },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true,
      transaction
    });
    const prevCreditors = await MonthlyCreditor.findOne({
      where: { companyId, month: prevClosedKey },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
      raw: true,
      transaction
    });
    const debtorsMom = prevDebtors ? lastClosedDebtorTotal - Number(prevDebtors.total || 0) : null;
    await upsertMetric(companyId, 'debtor_balance_mom_change', debtorsMom, 'mom', transaction, { month: latestClosedKey });
    const creditorsMom = prevCreditors ? lastClosedCreditorTotal - Number(prevCreditors.total || 0) : null;
    await upsertMetric(companyId, 'creditor_balance_mom_change', creditorsMom, 'mom', transaction, { month: latestClosedKey });
  }

  try {
    const { getSummary } = require('./debtorsService');
    const debtorsSummary = await getSummary(companyId);
    await upsertMetric(companyId, 'debtors_revenue_divergence', debtorsSummary?.divergenceFlag ? 1 : 0, 'last_closed_month', transaction, { month: latestClosedKey });
  } catch (error) {
    await upsertMetric(companyId, 'debtors_revenue_divergence', 0, 'last_closed_month', transaction, { month: latestClosedKey });
  }
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
      const normalized = await normalizeAccountHead(name);
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
        rawHeadName: name,
        canonicalType: normalized.canonicalType,
        canonicalSubtype: normalized.canonicalSubtype,
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
      const normalized = await normalizeAccountHead(name);
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
        rawHeadName: name,
        canonicalType: normalized.canonicalType,
        canonicalSubtype: normalized.canonicalSubtype,
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

  let revenueByName = [];
  let expenseByName = [];
  let revenue = parseFloat(totals.find(t => t.type === 'REVENUE')?.total || 0);
  let expenses = parseFloat(totals.find(t => t.type === 'EXPENSE')?.total || 0);

  if (totals.length > 0) {
    revenueByName = await FinancialTransaction.findAll({
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

    expenseByName = await FinancialTransaction.findAll({
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
    console.info({ companyId, monthKey }, 'snapshot: computed from transactions');
    await logSnapshotComputationSource(companyId, monthKey, 'transactions', transaction);
  } else {
    const balanceRows = await LedgerMonthlyBalance.findAll({
      where: { companyId, monthKey },
      raw: true,
      transaction
    });

    const revenueRows = balanceRows.filter((row) => (
      isRevenueCategory(row.cfoCategory) || isRevenueCategory(row.parentGroup)
    ));
    const expenseRows = balanceRows.filter((row) => (
      isExpenseCategory(row.cfoCategory) || isExpenseCategory(row.parentGroup)
    ));

    revenueByName = summarizeByLedgerName(revenueRows, 'revenue').map((row) => ({ category: row.name, total: row.total }));
    expenseByName = summarizeByLedgerName(expenseRows, 'expense').map((row) => ({ category: row.name, total: row.total }));

    revenue = revenueByName.reduce((sum, row) => sum + toNumber(row.total), 0);
    expenses = expenseByName.reduce((sum, row) => sum + toNumber(row.total), 0);
    console.info({ companyId, monthKey }, 'snapshot: computed from balances');
    await logSnapshotComputationSource(companyId, monthKey, 'balances', transaction);
  }

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

  for (const row of revenueByName) {
    const term = await resolveTermMapping('INTEGRATION', row.category || 'Revenue', 'REVENUE', transaction);
    const rawName = row.category || term.normalizedTerm;
    const normalized = await normalizeAccountHead(rawName);
    await MonthlyRevenueBreakdown.create({
      companyId,
      month: monthKey,
      revenueName: rawName,
      rawHeadName: rawName,
      canonicalType: normalized.canonicalType,
      canonicalSubtype: normalized.canonicalSubtype,
      normalizedRevenueCategory: term.normalizedTerm,
      amount: parseFloat(row.total || 0)
    }, { transaction });
  }

  for (const row of expenseByName) {
    const term = await resolveTermMapping('INTEGRATION', row.category || 'Expense', 'EXPENSE', transaction);
    const rawName = row.category || term.normalizedTerm;
    const normalized = await normalizeAccountHead(rawName);
    await MonthlyExpenseBreakdown.create({
      companyId,
      month: monthKey,
      expenseName: rawName,
      rawHeadName: rawName,
      canonicalType: normalized.canonicalType,
      canonicalSubtype: normalized.canonicalSubtype,
      normalizedExpenseCategory: term.normalizedTerm,
      amount: parseFloat(row.total || 0)
    }, { transaction });
  }
};

const updateCurrentBalances = async (companyId, payload, transaction, preferredMonthKey = null) => {
  const source = payload ? 'payload' : 'ledger_monthly_balances';
  const derivedPayload = payload || await deriveCurrentBalancesFromLedger(companyId, preferredMonthKey, transaction);
  if (!derivedPayload) return;
  const { cashBalances, debtors, creditors, loans } = derivedPayload;

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

  await logCurrentBalancesSource(companyId, preferredMonthKey, source, transaction);
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

const toDateOnlyString = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const writeLedgerMonthlyBalances = async (companyId, monthKey, payload, transaction) => {
  // Canonical classification pass: this is the source of truth for cfo_category.
  // Ingest-time categories are fallback hints only and may be overwritten here.
  const validation = validateChartOfAccountsPayload(payload);
  if (!validation.ok) {
    logUsageEvent({
      companyId,
      userId: null,
      eventType: validation.error.includes('missing') ? 'coa_payload_missing' : 'coa_payload_invalid',
      eventName: 'ledger_monthly_balances_not_written',
      metadata: { reason: validation.error, monthKey }
    });
    console.warn('COA payload invalid:', validation.error);
    return { written: 0, counts: { debtors: 0, creditors: 0, cash_bank: 0 } };
  }

  const { chartOfAccounts, asOfDate } = validation;
  const { totals, counts, classifications } = mapLedgersToCFOTotals(chartOfAccounts.ledgers, chartOfAccounts.groups);
  await upsertLedgerClassifications(companyId, classifications);

  const asOf = toDateOnlyString(asOfDate || new Date());
  const currentMonthKey = normalizeMonth(new Date());
  const isCurrentMonth = monthKey === currentMonthKey;
  const balanceMap = new Map();
  const balances = chartOfAccounts.balances || {};
  const closedEntry = Array.isArray(balances.closedMonths)
    ? balances.closedMonths.find((entry) => entry.monthKey === monthKey)
    : null;
  const items = monthKey === balances.current?.monthKey
    ? balances.current?.items
    : closedEntry?.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item) continue;
      const guid = item.ledgerGuid || item.guid || item.id;
      if (!guid) continue;
      const value = Number(item.balance || item.closingBalance || item.closing_balance || 0);
      balanceMap.set(guid, Number.isFinite(value) ? value : 0);
    }
  }
  let written = 0;
  const writtenCounts = { debtors: 0, creditors: 0, cash_bank: 0 };

  for (const row of classifications) {
    if (!row.ledgerGuid) continue;
    if (!['debtors', 'creditors', 'cash_bank'].includes(row.category)) continue;

    await LedgerMonthlyBalance.upsert({
      companyId,
      monthKey,
      ledgerGuid: row.ledgerGuid,
      ledgerName: row.ledgerName || 'Unknown',
      parentGroup: row.parentGroup || null,
      cfoCategory: row.category,
      balance: balanceMap.has(row.ledgerGuid) ? balanceMap.get(row.ledgerGuid) : Number(row.balance || 0),
      asOfDate: asOf
    }, { transaction });
    written += 1;
    writtenCounts[row.category] += 1;
  }

  console.info({
    companyId,
    monthKey,
    ledgers_parsed: chartOfAccounts.ledgers.length,
    ledgers_classified: classifications.length,
    revenueLedgers: counts.revenue,
    expenseLedgers: counts.expenses,
    debtorLedgers: counts.debtors,
    creditorLedgers: counts.creditors,
    cashBankLedgers: counts.cash_bank
  }, 'CFO mapping completed');

  console.info({
    companyId,
    monthKey,
    balances_written_current_month: isCurrentMonth ? written : 0,
    balances_written_closed_months: isCurrentMonth ? 0 : written,
    writtenDebtors: writtenCounts.debtors,
    writtenCreditors: writtenCounts.creditors,
    writtenCashBank: writtenCounts.cash_bank
  }, 'ledger_monthly_balances written');

  return { written, counts: writtenCounts, totals };
};

const recomputeSnapshots = async (companyId, amendedMonthKey = null, sourceLastSyncedAt = null, debtors = null, creditors = null, currentBalances = null, chartOfAccounts = null) => {
  const latestClosedKey = getLatestClosedMonthKey();
  if (!latestClosedKey) return { months: 0 };

  const startKey = amendedMonthKey || addMonths(latestClosedKey, -2);
  const monthKeys = listMonthKeysBetween(startKey, latestClosedKey);

  try {
    const { updateSyncStatus } = require('./snapshotValidator');
    await updateSyncStatus(companyId, {
      status: 'processing',
      lastSnapshotMonth: latestClosedKey,
      lastSyncStartedAt: new Date()
    });
  } catch (error) {
    console.warn('Sync status update failed:', error.message);
  }

  const debtorsByMonth = Array.isArray(debtors) ? { [amendedMonthKey]: debtors } : debtors;
  const creditorsByMonth = Array.isArray(creditors) ? { [amendedMonthKey]: creditors } : creditors;
  const ledgersByMonth = Array.isArray(chartOfAccounts) ? { [amendedMonthKey]: chartOfAccounts } : chartOfAccounts;

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

      const ledgerSnapshot = ledgersByMonth
        ? (ledgersByMonth[monthKey] || (ledgersByMonth.month === monthKey ? ledgersByMonth : null))
        : null;
      if (ledgerSnapshot) {
        const writeResult = await writeLedgerMonthlyBalances(companyId, monthKey, ledgerSnapshot, transaction);
        if (monthKey <= latestClosedKey && writeResult && writeResult.totals) {
          const revenueTotal = Number(writeResult.totals.revenue || 0);
          const expenseTotal = Number(writeResult.totals.expenses || 0);
          await MonthlyTrialBalanceSummary.update({
            totalRevenue: revenueTotal,
            totalExpenses: expenseTotal,
            netProfit: revenueTotal - expenseTotal,
            netCashflow: revenueTotal - expenseTotal,
            cashAndBankBalance: Number(writeResult.totals.cash_bank || 0)
          }, {
            where: { companyId, month: monthKey },
            transaction
          });
        }
      }
    }

    const currentMonthKey = normalizeMonth(new Date());
    if (currentMonthKey && !monthKeys.includes(currentMonthKey)) {
      const currentLedgerSnapshot = ledgersByMonth
        ? (ledgersByMonth[currentMonthKey] || (ledgersByMonth.month === currentMonthKey ? ledgersByMonth : null))
        : null;
      if (currentLedgerSnapshot) {
        await writeLedgerMonthlyBalances(companyId, currentMonthKey, currentLedgerSnapshot, transaction);
      }
    }

    const latestProcessedMonthKey = monthKeys[monthKeys.length - 1] || normalizeMonth(new Date());
    await updateCurrentBalances(companyId, currentBalances, transaction, latestProcessedMonthKey);
    await computeLiquidityMetrics(companyId, transaction);
    const { runCatalogMetrics } = require('../metrics/runCatalogMetrics');
    await runCatalogMetrics(companyId, {
      transaction,
      months: monthKeys,
      monthsBack: 24,
      includeLatest: true
    });
    await upsertAlerts(companyId, transaction);
    await trimOldSnapshots(companyId, latestClosedKey, transaction);
  });

  try {
    const { recomputeForCompany } = require('./cfoQuestionService');
    await recomputeForCompany(companyId);
    const { generateInsights } = require('./aiService');
    await generateInsights(companyId);
    const partyBalanceService = require('./partyBalanceService');
    await partyBalanceService.upsertLatestFromSnapshot(companyId);
  } catch (error) {
    console.warn('CFO question recompute failed:', error.message);
  }

  try {
    const {
      validateCompanySnapshot,
      updateSyncStatus,
      getLatestBalanceAsOfDate
    } = require('./snapshotValidator');
    let latestResult = null;
    for (const monthKey of monthKeys) {
      latestResult = await validateCompanySnapshot(companyId, monthKey);
    }
    const balanceAsOf = await getLatestBalanceAsOfDate(companyId);
    const finalStatus = latestResult?.status === 'invalid' ? 'failed' : 'ready';
    await updateSyncStatus(companyId, {
      status: finalStatus,
      lastSnapshotMonth: latestClosedKey,
      lastBalanceAsOfDate: balanceAsOf,
      lastSyncCompletedAt: new Date()
    });
  } catch (error) {
    try {
      const { updateSyncStatus } = require('./snapshotValidator');
      await updateSyncStatus(companyId, {
        status: 'failed',
        lastSnapshotMonth: latestClosedKey,
        errorMessage: error.message,
        lastSyncCompletedAt: new Date()
      });
    } catch (innerError) {
      console.warn('Snapshot validation failed:', innerError.message);
    }
  }

  return { months: monthKeys.length };
};

module.exports = {
  normalizeMonth,
  getLatestClosedMonthKey,
  listMonthKeysBetween,
  recomputeSnapshots,
  computeYoYGrowth,
  getRetentionWindow
};
