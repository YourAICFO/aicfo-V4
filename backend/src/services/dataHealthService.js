/**
 * Data Health / Mapping Transparency (Phase 1.9).
 * Read-only diagnostics from normalized tables only (no raw source).
 */

const { Sequelize } = require('sequelize');
const {
  MonthlyTrialBalanceSummary,
  LedgerMonthlyBalance,
  CFOLedgerClassification,
  MonthlyExpenseBreakdown,
  MonthlyDebtor,
  MonthlyCreditor,
  CFOMetric,
  sequelize
} = require('../models');
const { getLatestClosedMonthKey } = require('./monthlySnapshotService');
const debtorCreditorService = require('./debtorCreditorService');

const COGS_PROXY_CATEGORIES = [
  'cost of goods sold',
  'cogs',
  'purchases',
  'purchase accounts',
  'direct expenses'
];

/**
 * Get data health summary for a company.
 * Uses only normalized tables: MonthlyTrialBalanceSummary, LedgerMonthlyBalance,
 * CFOLedgerClassification, MonthlyExpenseBreakdown, debtors/creditors, data_sync_status.
 * @param {string} companyId
 * @returns {Promise<object>}
 */
async function getDataHealth(companyId) {
  const latestClosedKey = getLatestClosedMonthKey();

  const [
    summaryMonths,
    latestSummary,
    lmbCount,
    lmbInventoryCount,
    classificationCounts,
    unclassifiedRows,
    expenseRows,
    debtorsSummary,
    creditorsSummary,
    debtorDaysMetric,
    creditorDaysMetric,
    dataSyncRow
  ] = await Promise.all([
    MonthlyTrialBalanceSummary.findAll({
      where: { companyId },
      attributes: ['month'],
      raw: true
    }),
    MonthlyTrialBalanceSummary.findOne({
      where: { companyId },
      order: [['month', 'DESC']],
      attributes: ['month', 'inventoryTotal', 'totalRevenue', 'totalExpenses'],
      raw: true
    }),
    LedgerMonthlyBalance.count({
      where: { companyId, monthKey: latestClosedKey }
    }),
    LedgerMonthlyBalance.count({
      where: { companyId, monthKey: latestClosedKey, cfoCategory: 'inventory' }
    }),
    CFOLedgerClassification.findAll({
      where: { companyId },
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('COUNT', Sequelize.literal("CASE WHEN cfo_category IS NOT NULL AND cfo_category != '' THEN 1 END")), 'classified']
      ],
      raw: true
    }),
    CFOLedgerClassification.findAll({
      where: {
        companyId,
        [Sequelize.Op.or]: [{ cfoCategory: null }, { cfoCategory: '' }]
      },
      attributes: ['ledgerName', 'ledgerGuid'],
      limit: 10,
      order: [['lastSeenAt', 'DESC']],
      raw: true
    }),
    latestClosedKey
      ? MonthlyExpenseBreakdown.findAll({
          where: { companyId, month: latestClosedKey },
          attributes: ['normalizedExpenseCategory', 'amount'],
          raw: true
        })
      : [],
    debtorCreditorService.getDebtorsSummary(companyId).catch(() => null),
    debtorCreditorService.getCreditorsSummary(companyId).catch(() => null),
    latestClosedKey
      ? CFOMetric.findOne({
          where: {
            companyId,
            metricKey: 'debtor_days',
            timeScope: '3m',
            month: latestClosedKey
          },
          raw: true
        })
      : null,
    latestClosedKey
      ? CFOMetric.findOne({
          where: {
            companyId,
            metricKey: 'creditor_days',
            timeScope: '3m',
            month: latestClosedKey
          },
          raw: true
        })
      : null,
    getDataSyncStatus(companyId)
  ]);

  const months = summaryMonths.map((r) => r.month);
  const availableMonthsCount = months.length;
  const latestMonth = latestSummary?.month || latestClosedKey || null;

  const classRow = classificationCounts[0];
  const totalFromClass = Number(classRow?.total || 0);
  const classifiedFromClass = Number(classRow?.classified || 0);
  const totalLedgers = totalFromClass > 0 ? totalFromClass : lmbCount;
  const classifiedLedgers = totalFromClass > 0 ? classifiedFromClass : lmbCount;
  const unclassifiedCount = Math.max(0, totalLedgers - classifiedLedgers);
  const classifiedPct =
    totalLedgers > 0 ? Math.round((classifiedLedgers / totalLedgers) * 100) : 100;

  let cogsSum = 0;
  const cogsSet = new Set(COGS_PROXY_CATEGORIES);
  for (const r of expenseRows) {
    const cat = (r.normalizedExpenseCategory || r.normalized_expense_category || '')
      .toString()
      .trim()
      .toLowerCase();
    if (cat && cogsSet.has(cat)) cogsSum += Number(r.amount || 0);
  }
  const cogsMappingStatus = {
    isAvailable: Number.isFinite(cogsSum) && cogsSum > 0,
    reason:
      Number.isFinite(cogsSum) && cogsSum > 0
        ? null
        : 'No ledgers mapped to COGS proxy categories (e.g. Purchases, COGS, Direct Expenses) for last closed month.'
  };

  const inventoryTotal = latestSummary?.inventoryTotal != null
    ? Number(latestSummary.inventoryTotal)
    : null;
  const inventoryMappingStatus = {
    inventoryTotal: inventoryTotal ?? 0,
    inventoryLedgersCount: lmbInventoryCount,
    warning:
      (inventoryTotal == null || inventoryTotal === 0) &&
      latestSummary &&
      (Number(latestSummary.totalRevenue) > 0 || Number(latestSummary.totalExpenses) > 0)
        ? 'Inventory total is zero but P&L has activity; you may have inventory ledgers that are not mapped to the Inventory category.'
        : null
  };

  const debtorsTotal =
    debtorsSummary?.totalBalance != null ? Number(debtorsSummary.totalBalance) : null;
  const creditorsTotal =
    creditorsSummary?.totalBalance != null ? Number(creditorsSummary.totalBalance) : null;
  const debtorsMappingStatus = {
    total: debtorsTotal ?? 0,
    agingAvailable: debtorDaysMetric != null && Number.isFinite(Number(debtorDaysMetric?.metric_value ?? debtorDaysMetric?.metricValue))
  };
  const creditorsMappingStatus = {
    total: creditorsTotal ?? 0,
    agingAvailable: creditorDaysMetric != null && Number.isFinite(Number(creditorDaysMetric?.metric_value ?? creditorDaysMetric?.metricValue))
  };

  const topUnclassifiedLedgers = (unclassifiedRows || []).map((row) => ({
    name: row.ledgerName || row.ledger_name || 'Unknown',
    balance: null,
    lastMonth: latestMonth,
    count: null
  }));

  const lastSync = dataSyncRow
    ? {
        last_sync_at: dataSyncRow.last_sync_completed_at || dataSyncRow.last_sync_started_at,
        last_sync_status: dataSyncRow.status,
        last_sync_error: dataSyncRow.error_message || null
      }
    : { last_sync_at: null, last_sync_status: null, last_sync_error: null };

  return {
    classifiedPct,
    totalLedgers,
    classifiedLedgers,
    unclassifiedLedgers: unclassifiedCount,
    topUnclassifiedLedgers,
    cogsMappingStatus,
    inventoryMappingStatus,
    debtorsMappingStatus,
    creditorsMappingStatus,
    lastSync,
    availableMonthsCount,
    latestMonth
  };
}

/**
 * @param {string} companyId
 * @returns {Promise<object|null>}
 */
async function getDataSyncStatus(companyId) {
  try {
    const [row] = await sequelize.query(
      `SELECT status, last_sync_started_at, last_sync_completed_at, error_message
       FROM data_sync_status
       WHERE company_id = :companyId
       LIMIT 1`,
      {
        replacements: { companyId },
        type: sequelize.QueryTypes.SELECT
      }
    );
    return row || null;
  } catch (err) {
    const code = err?.original?.code || err?.parent?.code;
    if (code === '42P01' || code === '42703') return null;
    throw err;
  }
}

/**
 * Derive impact messages (e.g. CCC unavailable when COGS not mapped).
 * Pure function for testing.
 * @param {object} health - getDataHealth result
 * @returns {string[]}
 */
function getImpactMessages(health) {
  const messages = [];
  if (!health) return messages;
  if (health.cogsMappingStatus && !health.cogsMappingStatus.isAvailable) {
    messages.push('CCC and DIO/DPO metrics are unavailable because COGS (or equivalent) is not mapped.');
  }
  if (
    health.inventoryMappingStatus &&
    health.inventoryMappingStatus.warning
  ) {
    messages.push(health.inventoryMappingStatus.warning);
  }
  if (
    health.debtorsMappingStatus &&
    health.debtorsMappingStatus.total !== 0 &&
    !health.debtorsMappingStatus.agingAvailable
  ) {
    messages.push('Debtors aging (DSO) is not available; ensure debtors ledgers are mapped and data is synced.');
  }
  if (
    health.creditorsMappingStatus &&
    health.creditorsMappingStatus.total !== 0 &&
    !health.creditorsMappingStatus.agingAvailable
  ) {
    messages.push('Creditors aging (DPO) is not available; ensure creditors ledgers are mapped and data is synced.');
  }
  return messages;
}

/**
 * Suggested next steps (deterministic bullets).
 * @param {object} health - getDataHealth result
 * @returns {string[]}
 */
function getSuggestedNextSteps(health) {
  const steps = [];
  if (!health) return steps;
  if (health.unclassifiedLedgers > 0) {
    steps.push(`Map ${health.unclassifiedLedgers} unclassified ledger(s) to CFO categories to improve coverage.`);
  }
  if (health.cogsMappingStatus && !health.cogsMappingStatus.isAvailable) {
    steps.push('Map expense ledgers (e.g. Purchases, COGS) to a COGS proxy category so CCC and DIO can be computed.');
  }
  if (health.inventoryMappingStatus?.warning) {
    steps.push('Map inventory/stock ledgers to the Inventory category if your business holds stock.');
  }
  if (health.lastSync?.last_sync_status === 'failed' && health.lastSync?.last_sync_error) {
    steps.push('Fix the last sync error and re-sync to refresh data.');
  }
  if (health.availableMonthsCount === 0) {
    steps.push('Connect your accounting source and run a sync to load trial balance data.');
  }
  if (steps.length === 0 && health.classifiedPct < 100) {
    steps.push('Review ledger-to-category mappings for full coverage.');
  }
  return steps;
}

module.exports = {
  getDataHealth,
  getImpactMessages,
  getSuggestedNextSteps,
  getDataSyncStatus
};
