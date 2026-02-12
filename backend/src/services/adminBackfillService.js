const crypto = require('crypto');
const { Op, Sequelize } = require('sequelize');
const {
  FinancialTransaction,
  AccountingTermMapping,
  AccountHeadDictionary,
  AccountingMonth,
  MonthlyTrialBalanceSummary,
  LedgerMonthlyBalance,
  CurrentDebtor,
  CurrentCreditor,
  sequelize
} = require('../models');
const { normalizeMonth } = require('../utils/monthKeyUtils');
const { logUsageEvent } = require('./adminUsageService');
const { persistAppLog } = require('../utils/logSink');

const canonicalTypeToNormalizedType = (canonicalType) => {
  const value = String(canonicalType || '').toLowerCase();
  if (value === 'revenue') return 'REVENUE';
  if (value === 'expense') return 'EXPENSE';
  if (value === 'debtor' || value === 'cash' || value === 'bank' || value === 'asset') return 'ASSET';
  if (value === 'creditor' || value === 'liability') return 'LIABILITY';
  return null;
};

const normalizedTypeToCfoCategory = (normalizedType) => {
  if (normalizedType === 'REVENUE') return 'revenue';
  if (normalizedType === 'EXPENSE') return 'expenses';
  if (normalizedType === 'ASSET') return 'debtors';
  if (normalizedType === 'LIABILITY') return 'creditors';
  return null;
};

const getBestDictionaryMatch = (term, dictionaryRows) => {
  const source = String(term || '').trim().toLowerCase();
  if (!source) return null;
  let best = null;
  for (const row of dictionaryRows) {
    const pattern = String(row.match_pattern || row.matchPattern || '').trim().toLowerCase();
    if (!pattern) continue;
    if (source === pattern || source.includes(pattern) || pattern.includes(source)) {
      const score = pattern.length;
      const priority = Number(row.priority || 0);
      if (!best || score > best.score || (score === best.score && priority > best.priority)) {
        best = { row, score, priority };
      }
    }
  }
  return best ? best.row : null;
};

const getCompanyTransactionRows = async (companyId, monthsBack) => {
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - Math.max(monthsBack - 1, 0), 1));
  return FinancialTransaction.findAll({
    where: {
      companyId,
      date: { [Op.gte]: cutoff.toISOString().slice(0, 10) }
    },
    attributes: ['date', 'category', 'subcategory', 'metadata', 'amount'],
    raw: true
  });
};

const buildSourceTermsAndMonths = (rows) => {
  const terms = new Set();
  const months = new Set();
  for (const row of rows) {
    const monthKey = normalizeMonth(row.date);
    if (monthKey) months.add(monthKey);
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const candidates = [
      row.category,
      row.subcategory,
      metadata.account_name,
      metadata.ledger_name,
      metadata.head,
      metadata.name
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        terms.add(value.trim());
      }
    }
  }
  return { terms: [...terms], months: [...months].sort() };
};

const upsertTermMappings = async (sourceTerms, dictionaryRows) => {
  const mappingByTerm = new Map();
  let mappedCount = 0;
  for (const term of sourceTerms) {
    const best = getBestDictionaryMatch(term, dictionaryRows);
    const normalizedType = canonicalTypeToNormalizedType(best?.canonical_type || best?.canonicalType);
    if (!normalizedType) continue;
    const normalizedTerm = best?.canonical_subtype || best?.canonicalSubtype || best?.canonical_type || best?.canonicalType || term;
    const existing = await AccountingTermMapping.findOne({
      where: { sourceSystem: 'tally', sourceTerm: term }
    });
    if (existing) {
      await existing.update({
        normalizedTerm,
        normalizedType
      });
    } else {
      await AccountingTermMapping.create({
        sourceSystem: 'tally',
        sourceTerm: term,
        normalizedTerm,
        normalizedType
      });
    }
    mappingByTerm.set(term, { normalizedTerm, normalizedType });
    mappedCount += 1;
  }
  return { mappedCount, mappingByTerm };
};

const upsertAccountingMonths = async (companyId, months, markClosedThrough) => {
  for (const month of months) {
    const [record] = await AccountingMonth.findOrCreate({
      where: { companyId, month },
      defaults: { companyId, month, isClosed: false, sourceLastSyncedAt: new Date() }
    });
    if (record && !record.sourceLastSyncedAt) {
      await record.update({ sourceLastSyncedAt: new Date() });
    }
  }
  if (markClosedThrough) {
    await AccountingMonth.update(
      { isClosed: true },
      { where: { companyId, month: { [Op.lte]: markClosedThrough } } }
    );
  }
};

const upsertLedgerBalancesFromTransactions = async (companyId, rows, mappingByTerm) => {
  const aggregate = new Map();
  for (const row of rows) {
    const monthKey = normalizeMonth(row.date);
    const term = row.category || row.subcategory;
    if (!monthKey || !term) continue;
    const mapping = mappingByTerm.get(term);
    const cfoCategory = normalizedTypeToCfoCategory(mapping?.normalizedType);
    if (!cfoCategory) continue;
    const key = `${monthKey}||${term}`;
    const amount = Number(row.amount || 0);
    aggregate.set(key, (aggregate.get(key) || 0) + (Number.isFinite(amount) ? amount : 0));
  }

  let count = 0;
  for (const [key, total] of aggregate.entries()) {
    const [monthKey, term] = key.split('||');
    const mapping = mappingByTerm.get(term);
    const cfoCategory = normalizedTypeToCfoCategory(mapping?.normalizedType);
    if (!cfoCategory) continue;
    const guid = crypto.createHash('sha1').update(`${companyId}:${term}`).digest('hex');
    await LedgerMonthlyBalance.upsert({
      companyId,
      monthKey,
      ledgerGuid: guid,
      ledgerName: term,
      parentGroup: null,
      cfoCategory,
      balance: total,
      asOfDate: `${monthKey}-01`
    });
    count += 1;
  }
  return count;
};

const refreshCurrentPartiesFromLatestLedgerMonth = async (companyId) => {
  const latestMonth = await LedgerMonthlyBalance.findOne({
    where: { companyId, cfoCategory: { [Op.in]: ['debtors', 'creditors'] } },
    order: [['monthKey', 'DESC']],
    raw: true
  });
  if (!latestMonth) return { debtorsCount: 0, creditorsCount: 0 };
  const latestMonthKey = latestMonth.monthKey || latestMonth.month_key;

  const rows = await LedgerMonthlyBalance.findAll({
    where: {
      companyId,
      monthKey: latestMonthKey,
      cfoCategory: { [Op.in]: ['debtors', 'creditors'] }
    },
    raw: true
  });

  const debtors = rows.filter((r) => r.cfo_category === 'debtors');
  const creditors = rows.filter((r) => r.cfo_category === 'creditors');

  if (debtors.length) {
    await CurrentDebtor.destroy({ where: { companyId } });
    await CurrentDebtor.bulkCreate(
      debtors.map((r) => ({
        companyId,
        debtorName: r.ledger_name,
        balance: Number(r.balance || 0)
      }))
    );
  }
  if (creditors.length) {
    await CurrentCreditor.destroy({ where: { companyId } });
    await CurrentCreditor.bulkCreate(
      creditors.map((r) => ({
        companyId,
        creditorName: r.ledger_name,
        balance: Number(r.balance || 0)
      }))
    );
  }
  return { debtorsCount: debtors.length, creditorsCount: creditors.length };
};

const triggerSnapshotBuild = async (companyId, amendedMonth) => {
  if (process.env.DISABLE_WORKER === 'true') {
    const { recomputeSnapshots } = require('./monthlySnapshotService');
    return recomputeSnapshots(companyId, amendedMonth || null, new Date());
  }
  const { enqueueJob } = require('../worker/queue');
  await enqueueJob('generateMonthlySnapshots', { companyId, amendedMonth: amendedMonth || null });
  return { enqueued: true };
};

const backfillCompany = async ({ companyId, monthsBack = 18, markClosedThrough = null, runId = null }) => {
  const safeMonthsBack = Number.isFinite(Number(monthsBack)) ? Math.max(1, Number(monthsBack)) : 18;
  const txRows = await getCompanyTransactionRows(companyId, safeMonthsBack);
  const { terms, months } = buildSourceTermsAndMonths(txRows);
  const dictionaryRows = await AccountHeadDictionary.findAll({ raw: true });
  const { mappedCount, mappingByTerm } = await upsertTermMappings(terms, dictionaryRows);

  await upsertAccountingMonths(companyId, months, markClosedThrough);
  const ledgerRows = await upsertLedgerBalancesFromTransactions(companyId, txRows, mappingByTerm);
  const partyRefresh = await refreshCurrentPartiesFromLatestLedgerMonth(companyId);
  const amendedMonth = months.length ? months[0] : null;
  const snapshotTrigger = await triggerSnapshotBuild(companyId, amendedMonth);

  await logUsageEvent({
    companyId,
    userId: null,
    eventType: 'admin_backfill_company',
    eventName: 'admin_backfill_company',
    metadata: { companyId, monthsBack: safeMonthsBack, markClosedThrough }
  });

  await persistAppLog({
    level: 'info',
    service: 'ai-cfo-api',
    run_id: runId,
    company_id: companyId,
    event: 'BACKFILL_DONE',
    message: 'Admin backfill completed',
    data: {
      companyId,
      monthsBack: safeMonthsBack,
      markClosedThrough,
      termsDiscovered: terms.length,
      mappingsUpserted: mappedCount,
      accountingMonthsFound: months.length,
      ledgerRows,
      snapshotTrigger
    }
  });

  return {
    companyId,
    monthsBack: safeMonthsBack,
    markClosedThrough,
    termsDiscovered: terms.length,
    mappingsUpserted: mappedCount,
    accountingMonthsFound: months.length,
    ledgerRows,
    currentParties: partyRefresh,
    snapshotTrigger
  };
};

const getBackfillStatus = async (companyId) => {
  const txRows = await FinancialTransaction.findAll({
    where: { companyId },
    attributes: ['category', 'subcategory', 'metadata'],
    raw: true
  });
  const { terms } = buildSourceTermsAndMonths(txRows);
  const mappedForCompanyTerms = terms.length
    ? await AccountingTermMapping.count({
        where: { sourceSystem: 'tally', sourceTerm: { [Op.in]: terms } }
      })
    : 0;

  const [monthsCount, closedMonthsCount, summaryCount, ledgerCount, debtorsCount, creditorsCount] = await Promise.all([
    AccountingMonth.count({ where: { companyId } }),
    AccountingMonth.count({ where: { companyId, isClosed: true } }),
    MonthlyTrialBalanceSummary.count({ where: { companyId } }),
    LedgerMonthlyBalance.count({ where: { companyId } }),
    CurrentDebtor.count({ where: { companyId } }),
    CurrentCreditor.count({ where: { companyId } })
  ]);

  const byCategory = await sequelize.query(
    `SELECT month_key, cfo_category, COUNT(*)::int AS count
     FROM ledger_monthly_balances
     WHERE company_id = :companyId
     GROUP BY month_key, cfo_category
     ORDER BY month_key DESC, cfo_category ASC`,
    { replacements: { companyId }, type: Sequelize.QueryTypes.SELECT }
  );

  return {
    companyId,
    accounting_term_mapping_count: mappedForCompanyTerms,
    accounting_months_count: monthsCount,
    accounting_months_closed_count: closedMonthsCount,
    monthly_trial_balance_summary_count: summaryCount,
    ledger_monthly_balances_count: ledgerCount,
    ledger_monthly_balances_by_period_category: byCategory,
    current_debtors_count: debtorsCount,
    current_creditors_count: creditorsCount
  };
};

module.exports = {
  backfillCompany,
  getBackfillStatus
};
