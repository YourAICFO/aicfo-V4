const { CFOMetric } = require('../models');
const { MetricsDataAccess } = require('./dataAccess');
const { metricsCatalog, metricsCatalogCount } = require('./metricsCatalog');

const normalizeMetricValue = (value, valueType) => {
  if (value === null || value === undefined) return null;
  if (valueType === 'flag') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const num = Number(value);
    return Number.isFinite(num) ? (num ? 1 : 0) : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const upsertMetric = async ({
  companyId,
  metricKey,
  metricValue,
  timeScope,
  month,
  changePct = null,
  severity = null,
  transaction = null
}) => {
  const normalizedScope = (timeScope || 'live').toLowerCase();
  const isMonthly = normalizedScope === 'month';
  const metricMonth = isMonthly ? month : null;

  if (isMonthly && !metricMonth) return;

  const where = {
    companyId,
    metricKey,
    timeScope: normalizedScope,
    ...(isMonthly ? { month: metricMonth } : {})
  };

  const payload = {
    companyId,
    metricKey,
    metricValue,
    metricText: metricValue === null || metricValue === undefined ? null : String(metricValue),
    timeScope: normalizedScope,
    month: metricMonth,
    changePct,
    severity,
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

const dedupeMonths = (months = []) => Array.from(new Set((months || []).filter(Boolean))).sort();

const runCatalogMetrics = async (companyId, opts = {}) => {
  const transaction = opts.transaction || null;
  const monthsBack = Number(opts.monthsBack || 24);
  const includeLatest = opts.includeLatest !== false;
  const explicitMonths = dedupeMonths(opts.months || []);

  const dataAccess = new MetricsDataAccess({ companyId, transaction, monthsBack });
  await dataAccess.load();

  const latestMonth = dataAccess.getLatestMonth();
  const monthTargets = explicitMonths.length > 0
    ? explicitMonths.filter((month) => !latestMonth || month <= latestMonth)
    : dataAccess.getMonthKeys();

  const summary = {
    metricDefinitions: metricsCatalogCount,
    written: 0,
    skipped: 0,
    failures: [],
    missingMetricKeys: []
  };

  for (const definition of metricsCatalog) {
    const targetMonths = definition.scope === 'month' ? monthTargets : [null];
    if (definition.scope !== 'month' && !includeLatest) continue;

    for (const month of targetMonths) {
      try {
        const rawValue = await definition.compute({
          companyId,
          month,
          tx: transaction,
          dataAccess
        });

        const value = normalizeMetricValue(rawValue, definition.valueType);
        if ((value === null || value === undefined) && !definition.allowNull) {
          summary.skipped += 1;
          summary.missingMetricKeys.push(definition.key);
          continue;
        }

        const severityMeta = typeof definition.severityRule === 'function'
          ? definition.severityRule({ value, month, companyId })
          : null;

        await upsertMetric({
          companyId,
          metricKey: definition.key,
          metricValue: value,
          timeScope: definition.timeScope || (definition.scope === 'month' ? 'month' : 'live'),
          month,
          changePct: severityMeta?.changePct ?? null,
          severity: severityMeta?.severity || null,
          transaction
        });

        summary.written += 1;
      } catch (error) {
        summary.failures.push({
          key: definition.key,
          month,
          error: error.message
        });
      }
    }
  }

  summary.missingMetricKeys = Array.from(new Set(summary.missingMetricKeys)).sort();
  return summary;
};

module.exports = {
  runCatalogMetrics,
  metricsCatalogCount
};
