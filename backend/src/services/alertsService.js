/**
 * Deterministic Red Flag / Alerts engine (no AI).
 * Rules: net profit drop >30% MoM, revenue drop >20% MoM, debtors increase >25% MoM, runway <4 months.
 * Returns max 5 alerts sorted by severity (critical > high > medium).
 */

const { MonthlyTrialBalanceSummary } = require('../models');
const runwayService = require('./runwayService');
const { getLatestClosedMonthKey } = require('./monthlySnapshotService');
const debtorCreditorService = require('./debtorCreditorService');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };
const MAX_ALERTS = 5;

const normalizeMonth = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 7);
};

/**
 * @param {string} companyId
 * @returns {Promise<Array<{ id: string, ruleKey: string, severity: 'critical'|'high'|'medium', title: string, message: string, link: string }>>}
 */
const getAlerts = async (companyId) => {
  const alerts = [];
  const latestClosed = getLatestClosedMonthKey();
  if (!latestClosed) return alerts.slice(0, MAX_ALERTS);

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
    debtorsSummary
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
    debtorCreditorService.getDebtorsSummary(companyId).catch(() => null)
  ]);

  // Rule: Runway < 4 months
  const runwayMonths = runwayResult.runwayMonths;
  if (typeof runwayMonths === 'number' && runwayMonths < 4 && runwayMonths >= 0) {
    alerts.push({
      id: `runway-${companyId}`,
      ruleKey: 'runway_low',
      severity: 'critical',
      title: 'Low runway',
      message: `Cash runway is ${runwayMonths} months (below 4 months).`,
      link: '/dashboard'
    });
  }

  // Rule: Net profit drop > 30% MoM
  const netProfitLatest = Number(
    summaryLatest?.net_profit ?? (Number(summaryLatest?.total_revenue ?? 0) - Number(summaryLatest?.total_expenses ?? 0))
  );
  const netProfitPrev = Number(
    summaryPrev?.net_profit ?? (Number(summaryPrev?.total_revenue ?? 0) - Number(summaryPrev?.total_expenses ?? 0))
  );
  if (netProfitPrev > 0 && netProfitLatest !== undefined && !Number.isNaN(netProfitLatest)) {
    const pctChange = ((netProfitLatest - netProfitPrev) / netProfitPrev) * 100;
    if (pctChange <= -30) {
      alerts.push({
        id: `net-profit-${companyId}-${latestClosed}`,
        ruleKey: 'net_profit_drop',
        severity: 'high',
        title: 'Net profit drop',
        message: `Net profit down ${Math.round(Math.abs(pctChange))}% vs previous month.`,
        link: '/pl-pack'
      });
    }
  }

  // Rule: Revenue drop > 20% MoM
  const revenueLatest = Number(summaryLatest?.total_revenue ?? 0);
  const revenuePrev = Number(summaryPrev?.total_revenue ?? 0);
  if (revenuePrev > 0 && revenueLatest !== undefined) {
    const pctChange = ((revenueLatest - revenuePrev) / revenuePrev) * 100;
    if (pctChange <= -20) {
      alerts.push({
        id: `revenue-${companyId}-${latestClosed}`,
        ruleKey: 'revenue_drop',
        severity: 'high',
        title: 'Revenue drop',
        message: `Revenue down ${Math.round(Math.abs(pctChange))}% vs previous month.`,
        link: '/pl-pack'
      });
    }
  }

  // Rule: Debtors (collections risk) increased > 25% MoM — use total debtors as proxy for >90 days when no ageing
  if (debtorsSummary?.changeVsPrevClosed?.pct != null && debtorsSummary.changeVsPrevClosed.pct > 25) {
    alerts.push({
      id: `debtors-${companyId}-${latestClosed}`,
      ruleKey: 'debtors_increase',
      severity: 'medium',
      title: 'Collections risk',
      message: `Debtors outstanding increased ${Math.round(debtorsSummary.changeVsPrevClosed.pct)}% vs previous month.`,
      link: '/working-capital'
    });
  }

  // Sort by severity (critical first, then high, then medium), then keep order
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return alerts.slice(0, MAX_ALERTS);
};

module.exports = {
  getAlerts
};
