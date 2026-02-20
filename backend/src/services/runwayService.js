/**
 * Cash runway from snapshot cash & bank movement only (no P&L proxy).
 * Uses MonthlyTrialBalanceSummary.cash_and_bank_balance for opening/closing and net movement.
 */
const { Sequelize } = require('sequelize');
const { MonthlyTrialBalanceSummary, CurrentCashBalance } = require('../models');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Get cash & bank series: last N available months with opening, closing, netChange.
 * netChange(month) = closing(month) - opening(month); opening(month) = closing(previous month).
 * @param {string} companyId
 * @param {number} lastN - max number of months to consider (default 6)
 * @returns {{ months: string[], series: Array<{ month: string, opening: number, closing: number, netChange: number }> }}
 */
const getCashBankSeries = async (companyId, lastN = 6) => {
  const rows = await MonthlyTrialBalanceSummary.findAll({
    where: { companyId },
    attributes: ['month', 'cashAndBankBalance'],
    order: [['month', 'ASC']],
    raw: true
  });
  if (rows.length < 2) {
    return { months: rows.map((r) => r.month), series: [] };
  }
  const take = Math.min(lastN + 1, rows.length);
  const lastRows = rows.slice(-take);
  const series = [];
  for (let i = 1; i < lastRows.length; i++) {
    const prev = lastRows[i - 1];
    const curr = lastRows[i];
    const opening = toNum(prev.cashAndBankBalance ?? prev.cash_and_bank_balance);
    const closing = toNum(curr.cashAndBankBalance ?? curr.cash_and_bank_balance);
    series.push({
      month: curr.month,
      opening,
      closing,
      netChange: closing - opening
    });
  }
  return {
    months: lastRows.map((r) => r.month),
    series
  };
};

const MIN_MONTHS_FOR_RUNWAY = 3;
const STATUS_GREEN = 'GREEN';
const STATUS_AMBER = 'AMBER';
const STATUS_RED = 'RED';
const LABEL_GROWING = 'Growing';
const LABEL_INSUFFICIENT = 'Insufficient data';
const LABEL_CRITICAL = 'Critical';

/**
 * Pure: compute runway outcome from current cash and series length + avg net change.
 * Used by getRunway and by unit tests with fixtures.
 * @param {number} currentCashBankClosing
 * @param {number} monthsAvailable - count of months with data
 * @param {number | null} avgNetCashChange6M - average of net movement (closing - opening) over available months
 * @returns {{ runwayMonths: number | null, status: string, statusLabel: string }}
 */
function computeRunwayFromSeries(currentCashBankClosing, monthsAvailable, avgNetCashChange6M) {
  if (monthsAvailable < MIN_MONTHS_FOR_RUNWAY) {
    return { runwayMonths: null, status: 'UNKNOWN', statusLabel: LABEL_INSUFFICIENT };
  }
  if (currentCashBankClosing <= 0) {
    return { runwayMonths: 0, status: STATUS_RED, statusLabel: LABEL_CRITICAL };
  }
  if (avgNetCashChange6M === null || avgNetCashChange6M >= 0) {
    return { runwayMonths: null, status: STATUS_GREEN, statusLabel: LABEL_GROWING };
  }
  const denom = Math.abs(avgNetCashChange6M);
  const runwayMonths = denom > 0 ? currentCashBankClosing / denom : 0;
  let status = STATUS_RED;
  if (runwayMonths >= 6) status = STATUS_GREEN;
  else if (runwayMonths >= 3) status = STATUS_AMBER;
  return {
    runwayMonths: Math.round(runwayMonths * 10) / 10,
    status,
    statusLabel: `${runwayMonths.toFixed(1)} months`
  };
}

/**
 * Compute runway from cash & bank movement (snapshot-based).
 * - currentCashBankClosing: from latest snapshot or CurrentCashBalance sum.
 * - avgNetCashChange6M: average of net cash movement over last available months (up to 6 deltas).
 * - If avg < 0: runwayMonths = currentCash / abs(avg); status by threshold.
 * - If avg >= 0: runwayMonths = null, statusLabel = "Growing".
 * - If < 3 months available: statusLabel = "Insufficient data".
 * - If currentCash <= 0: runwayMonths = 0, statusLabel = "Critical".
 *
 * @param {string} companyId
 * @returns {Promise<{ currentCashBankClosing: number, avgNetCashChange6M: number | null, runwayMonths: number | null, status: string, statusLabel: string }>}
 */
const getRunway = async (companyId) => {
  const latestSummary = await MonthlyTrialBalanceSummary.findOne({
    where: { companyId },
    order: [['month', 'DESC']],
    attributes: ['month', 'cashAndBankBalance'],
    raw: true
  });
  let currentCashBankClosing = 0;
  if (latestSummary) {
    currentCashBankClosing = toNum(latestSummary.cashAndBankBalance ?? latestSummary.cash_and_bank_balance);
  }
  if (currentCashBankClosing === 0) {
    const currentRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true });
    currentCashBankClosing = currentRows.reduce((sum, r) => sum + toNum(r.balance), 0);
  }

  const { months, series } = await getCashBankSeries(companyId, 6);
  const avgNetCashChange6M = series.length
    ? series.reduce((s, x) => s + x.netChange, 0) / series.length
    : null;
  const { runwayMonths, status, statusLabel } = computeRunwayFromSeries(
    currentCashBankClosing,
    months.length,
    avgNetCashChange6M
  );
  const runwaySeries = series.slice(-6).map((s) => ({
    month: s.month,
    netChange: s.netChange,
    closing: s.closing
  }));
  return {
    currentCashBankClosing,
    cashBase: currentCashBankClosing,
    avgNetCashChange6M,
    runwayMonths,
    status,
    statusLabel,
    runwaySeries
  };
};

module.exports = {
  getCashBankSeries,
  getRunway,
  computeRunwayFromSeries,
  LABEL_GROWING,
  LABEL_INSUFFICIENT,
  LABEL_CRITICAL,
  MIN_MONTHS_FOR_RUNWAY
};
