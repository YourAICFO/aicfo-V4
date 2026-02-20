/**
 * Deterministic Red Flag / Alerts engine (no AI).
 * Rules: net profit drop >30% MoM, revenue drop >20% MoM, debtors increase >25% MoM, runway <4 months.
 * Returns max 5 alerts sorted by severity. Alert fatigue: snooze/dismiss with condition hash.
 */

const { MonthlyTrialBalanceSummary, CFOMetric, AlertState } = require('../models');
const runwayService = require('./runwayService');
const { getLatestClosedMonthKey } = require('./monthlySnapshotService');
const debtorCreditorService = require('./debtorCreditorService');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };
const MAX_ALERTS = 5;
const SNOOZE_DAYS_OPTIONS = [7, 30];
const DEFAULT_INVENTORY_DAYS_THRESHOLD = Number(process.env.INVENTORY_DAYS_ALERT_THRESHOLD) || 90;

const normalizeMonth = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 7);
};

/**
 * Stable string for "this occurrence" so we can re-show when condition changes.
 * @param {string} ruleKey
 * @param {string} month - latestClosed
 * @param {string|number} bucket - value bucket (e.g. runway months, pct rounded)
 */
function computeConditionHash(ruleKey, month, bucket) {
  const b = bucket != null && bucket !== '' ? String(bucket) : '';
  return `${ruleKey}|${month || ''}|${b}`;
}

/**
 * Returns raw alerts with conditionHash (no state filtering). Used by getAlerts and dismiss.
 * @param {string} companyId
 * @returns {Promise<Array<{ id: string, ruleKey: string, severity: string, title: string, message: string, link: string, conditionHash: string }>>}
 */
async function getRawAlerts(companyId) {
  const alerts = [];
  const latestClosed = getLatestClosedMonthKey();
  if (!latestClosed) return alerts;

  const latestDate = new Date(
    parseInt(latestClosed.slice(0, 4), 10),
    parseInt(latestClosed.slice(5, 7), 10) - 1,
    1
  );
  const prevMonth = normalizeMonth(new Date(latestDate.getFullYear(), latestDate.getMonth() - 1, 1));

  const [
    runwayResult,
    summaryLatest,
    summaryPrev,
    debtorsSummary,
    inventoryDaysRow
  ] = await Promise.all([
    runwayService.getRunway(companyId),
    MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month: latestClosed },
      raw: true
    }),
    MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month: prevMonth },
      raw: true
    }),
    debtorCreditorService.getDebtorsSummary(companyId).catch(() => null),
    CFOMetric.findOne({
      where: { companyId, metricKey: 'inventory_days', timeScope: '3m', month: latestClosed },
      attributes: ['metric_value'],
      raw: true
    })
  ]);

  const runwayMonths = runwayResult.runwayMonths;
  if (typeof runwayMonths === 'number' && runwayMonths < 4 && runwayMonths >= 0) {
    const conditionHash = computeConditionHash('runway_low', latestClosed, Math.floor(runwayMonths));
    alerts.push({
      id: `runway-${companyId}`,
      ruleKey: 'runway_low',
      severity: 'critical',
      title: 'Low runway',
      message: `Cash runway is ${runwayMonths} months (below 4 months).`,
      link: '/dashboard',
      conditionHash
    });
  }

  const netProfitLatest = Number(
    summaryLatest?.net_profit ?? (Number(summaryLatest?.total_revenue ?? 0) - Number(summaryLatest?.total_expenses ?? 0))
  );
  const netProfitPrev = Number(
    summaryPrev?.net_profit ?? (Number(summaryPrev?.total_revenue ?? 0) - Number(summaryPrev?.total_expenses ?? 0))
  );
  if (netProfitPrev > 0 && netProfitLatest !== undefined && !Number.isNaN(netProfitLatest)) {
    const pctChange = ((netProfitLatest - netProfitPrev) / netProfitPrev) * 100;
    if (pctChange <= -30) {
      const bucket = Math.round(Math.abs(pctChange));
      alerts.push({
        id: `net-profit-${companyId}-${latestClosed}`,
        ruleKey: 'net_profit_drop',
        severity: 'high',
        title: 'Net profit drop',
        message: `Net profit down ${bucket}% vs previous month.`,
        link: '/pl-pack',
        conditionHash: computeConditionHash('net_profit_drop', latestClosed, bucket)
      });
    }
  }

  const revenueLatest = Number(summaryLatest?.total_revenue ?? 0);
  const revenuePrev = Number(summaryPrev?.total_revenue ?? 0);
  if (revenuePrev > 0 && revenueLatest !== undefined) {
    const pctChange = ((revenueLatest - revenuePrev) / revenuePrev) * 100;
    if (pctChange <= -20) {
      const bucket = Math.round(Math.abs(pctChange));
      alerts.push({
        id: `revenue-${companyId}-${latestClosed}`,
        ruleKey: 'revenue_drop',
        severity: 'high',
        title: 'Revenue drop',
        message: `Revenue down ${bucket}% vs previous month.`,
        link: '/pl-pack',
        conditionHash: computeConditionHash('revenue_drop', latestClosed, bucket)
      });
    }
  }

  if (debtorsSummary?.changeVsPrevClosed?.pct != null && debtorsSummary.changeVsPrevClosed.pct > 25) {
    const bucket = Math.round(debtorsSummary.changeVsPrevClosed.pct);
    alerts.push({
      id: `debtors-${companyId}-${latestClosed}`,
      ruleKey: 'debtors_increase',
      severity: 'medium',
      title: 'Collections risk',
      message: `Debtors outstanding increased ${bucket}% vs previous month.`,
      link: '/working-capital',
      conditionHash: computeConditionHash('debtors_increase', latestClosed, bucket)
    });
  }

  const prevInvRaw = summaryPrev?.inventory_total ?? summaryPrev?.inventoryTotal;
  const latestInvRaw = summaryLatest?.inventory_total ?? summaryLatest?.inventoryTotal;
  const prevInv = prevInvRaw != null ? Number(prevInvRaw) : NaN;
  const latestInv = latestInvRaw != null ? Number(latestInvRaw) : NaN;
  const inventoryMomPct =
    Number.isFinite(prevInv) && Number.isFinite(latestInv) && prevInv > 0
      ? ((latestInv - prevInv) / prevInv) * 100
      : null;
  const revenueFlatOrDown = revenuePrev > 0 && (revenueLatest <= revenuePrev || ((revenueLatest - revenuePrev) / revenuePrev) * 100 < 2);
  if (inventoryMomPct != null && Number.isFinite(inventoryMomPct) && inventoryMomPct > 25 && revenueFlatOrDown) {
    const bucket = Math.round(inventoryMomPct);
    alerts.push({
      id: `inventory-up-revenue-flat-${companyId}-${latestClosed}`,
      ruleKey: 'inventory_up_revenue_flat',
      severity: 'medium',
      title: 'Inventory build-up',
      message: `Inventory increased ${bucket}% MoM while revenue is flat or down.`,
      link: '/working-capital',
      conditionHash: computeConditionHash('inventory_up_revenue_flat', latestClosed, bucket)
    });
  }

  const inventoryDays = inventoryDaysRow != null ? Number(inventoryDaysRow.metric_value ?? inventoryDaysRow.metricValue) : null;
  if (inventoryDays != null && Number.isFinite(inventoryDays) && inventoryDays > DEFAULT_INVENTORY_DAYS_THRESHOLD) {
    const bucket = Math.round(inventoryDays);
    alerts.push({
      id: `inventory-days-high-${companyId}-${latestClosed}`,
      ruleKey: 'inventory_days_high',
      severity: 'medium',
      title: 'High inventory days',
      message: `Inventory days (DIO) is ${bucket} days (above ${DEFAULT_INVENTORY_DAYS_THRESHOLD} day threshold).`,
      link: '/working-capital',
      conditionHash: computeConditionHash('inventory_days_high', latestClosed, bucket)
    });
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return alerts;
}

/**
 * @param {string} companyId
 * @returns {Promise<Array<{ id: string, ruleKey: string, severity: string, title: string, message: string, link: string, conditionHash?: string, isSnoozed: boolean, snoozedUntil: string|null, isDismissed: boolean }>>}
 */
const getAlerts = async (companyId) => {
  const raw = await getRawAlerts(companyId);
  if (raw.length === 0) return [];

  const now = new Date();
  const states = await AlertState.findAll({
    where: { companyId },
    raw: true
  });
  const stateByRule = new Map(states.map((s) => [s.ruleKey, s]));

  const out = [];
  for (const alert of raw) {
    const state = stateByRule.get(alert.ruleKey);
    if (state?.snoozedUntil && new Date(state.snoozedUntil) > now) {
      continue;
    }
    if (state?.dismissedAt && state.lastConditionHash === alert.conditionHash) {
      continue;
    }
    out.push({
      id: alert.id,
      ruleKey: alert.ruleKey,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      link: alert.link,
      isSnoozed: false,
      snoozedUntil: null,
      isDismissed: false
    });
    if (out.length >= MAX_ALERTS) break;
  }
  return out;
};

/**
 * @param {string} companyId
 * @param {string} ruleKey
 * @param {number} days - 7 or 30
 */
const snooze = async (companyId, ruleKey, days) => {
  if (!SNOOZE_DAYS_OPTIONS.includes(days)) {
    throw new Error(`days must be one of ${SNOOZE_DAYS_OPTIONS.join(', ')}`);
  }
  const until = new Date();
  until.setDate(until.getDate() + days);
  const [row] = await AlertState.findOrCreate({
    where: { companyId, ruleKey },
    defaults: { companyId, ruleKey, snoozedUntil: until, dismissedAt: null, lastConditionHash: null }
  });
  await row.update({ snoozedUntil: until, dismissedAt: null, lastConditionHash: null });
  return row;
};

/**
 * @param {string} companyId
 * @param {string} ruleKey
 */
const dismiss = async (companyId, ruleKey) => {
  const raw = await getRawAlerts(companyId);
  const alert = raw.find((a) => a.ruleKey === ruleKey);
  const conditionHash = alert?.conditionHash ?? null;
  const [row] = await AlertState.findOrCreate({
    where: { companyId, ruleKey },
    defaults: { companyId, ruleKey, dismissedAt: new Date(), lastConditionHash: conditionHash }
  });
  await row.update({ snoozedUntil: null, dismissedAt: new Date(), lastConditionHash: conditionHash });
  return row;
};

/**
 * @param {string} companyId
 * @param {string} ruleKey
 */
const clear = async (companyId, ruleKey) => {
  const row = await AlertState.findOne({ where: { companyId, ruleKey } });
  if (!row) return null;
  await row.update({
    snoozedUntil: null,
    dismissedAt: null,
    lastConditionHash: null
  });
  return row;
};

module.exports = {
  getAlerts,
  snooze,
  dismiss,
  clear,
  computeConditionHash,
  getRawAlerts
};
