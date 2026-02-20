/**
 * Layer-1 Data Consistency Validator (trust audit).
 * Runs reconciliation checks for a company and month. No AI; additive only.
 */

const { Sequelize } = require('sequelize');
const {
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  LedgerMonthlyBalance
} = require('../models');
const runwayService = require('./runwayService');
const plPackService = require('./plPackService');

const STATUS_PASS = 'PASS';
const STATUS_WARN = 'WARN';
const STATUS_FAIL = 'FAIL';

const DEFAULT_AMOUNT_TOLERANCE = 1;
const DEFAULT_PCT_TOLERANCE = 0.01;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {number} expected
 * @param {number} actual
 * @param {{ amount?: number, pct?: number }} tolerance
 * @returns {boolean} true if within tolerance
 */
const withinTolerance = (expected, actual, tolerance) => {
  const rawAmount = tolerance?.amount;
  const amountTol = Math.abs(
    rawAmount !== undefined && rawAmount !== null && Number.isFinite(Number(rawAmount))
      ? Number(rawAmount)
      : DEFAULT_AMOUNT_TOLERANCE
  );
  const diff = Math.abs(toNum(actual) - toNum(expected));
  if (diff <= amountTol) return true;
  const rawPct = tolerance?.pct;
  const pctTol =
    rawPct !== undefined && rawPct !== null && Number.isFinite(Number(rawPct))
      ? Number(rawPct)
      : DEFAULT_PCT_TOLERANCE;
  const base = Math.max(Math.abs(toNum(expected)), Math.abs(toNum(actual)), 1);
  return diff / base <= pctTol;
};

/**
 * Run all consistency checks for a company and month.
 * @param {string} companyId
 * @param {string} monthKey - YYYY-MM
 * @param {{ amount?: number, pct?: number }} [tolerance]
 * @returns {Promise<{ month: string, checks: Array<{ key: string, status: string, message: string, expected?: number, actual?: number }>, tolerance: object }>}
 */
const runChecks = async (companyId, monthKey, tolerance = {}) => {
  const rawAmount = tolerance?.amount;
  const amountTol = Math.abs(
    rawAmount !== undefined && rawAmount !== null && Number.isFinite(Number(rawAmount))
      ? Number(rawAmount)
      : DEFAULT_AMOUNT_TOLERANCE
  );
  const rawPct = tolerance?.pct;
  const pctTol =
    rawPct !== undefined && rawPct !== null && Number.isFinite(Number(rawPct))
      ? Number(rawPct)
      : DEFAULT_PCT_TOLERANCE;
  const tol = { amount: amountTol, pct: pctTol };
  const checks = [];

  const month = /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : null;
  if (!companyId || !month) {
    return {
      month: monthKey || '',
      checks: [{ key: 'params', status: STATUS_FAIL, message: 'companyId and month (YYYY-MM) are required' }],
      tolerance: tol
    };
  }

  try {
    // --- A) Cash consistency: runway cashBase == latest cash_and_bank_balance in MonthlyTrialBalanceSummary ---
    const runwayResult = await runwayService.getRunway(companyId).catch(() => null);
    const latestSummary = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId },
      order: [['month', 'DESC']],
      attributes: ['month', 'cashAndBankBalance'],
      raw: true
    });
    const cashBase = runwayResult?.cashBase ?? runwayResult?.currentCashBankClosing;
    const summaryCash = latestSummary
      ? toNum(latestSummary.cashAndBankBalance ?? latestSummary.cash_and_bank_balance)
      : null;
    if (summaryCash === null && cashBase === undefined) {
      checks.push({ key: 'cash_consistency', status: STATUS_WARN, message: 'No snapshot or runway cash to compare' });
    } else if (summaryCash !== null && cashBase !== undefined && cashBase !== null) {
      const match = withinTolerance(summaryCash, cashBase, tol);
      checks.push({
        key: 'cash_consistency',
        status: match ? STATUS_PASS : STATUS_FAIL,
        message: match
          ? 'Dashboard cash (runway cashBase) matches latest snapshot cash_and_bank_balance'
          : 'Dashboard cash (runway cashBase) does not match latest snapshot cash_and_bank_balance',
        expected: summaryCash,
        actual: cashBase
      });
    } else {
      checks.push({
        key: 'cash_consistency',
        status: STATUS_WARN,
        message: 'Runway or latest summary missing; cannot compare',
        expected: summaryCash ?? undefined,
        actual: cashBase ?? undefined
      });
    }

    // --- B) P&L totals reconcile: pl-pack revenue/opex vs sum(breakdowns) for month ---
    let pack = null;
    try {
      pack = await plPackService.getPlPackWithDrivers(companyId, month);
    } catch (e) {
      checks.push({ key: 'pl_revenue_breakdown', status: STATUS_FAIL, message: `Pl-pack load failed: ${e.message}` });
      checks.push({ key: 'pl_expenses_breakdown', status: STATUS_FAIL, message: `Pl-pack load failed: ${e.message}` });
    }

    if (pack) {
      const [revenueSumRow, expenseSumRow] = await Promise.all([
        MonthlyRevenueBreakdown.findAll({
          where: { companyId, month },
          attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
          raw: true
        }),
        MonthlyExpenseBreakdown.findAll({
          where: { companyId, month },
          attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
          raw: true
        })
      ]);
      const sumRevenue = toNum(revenueSumRow?.[0]?.total);
      const sumExpenses = toNum(expenseSumRow?.[0]?.total);
      const packRevenue = toNum(pack.current?.totalRevenue);
      const packExpenses = toNum(pack.current?.totalExpenses);

      const revMatch = withinTolerance(packRevenue, sumRevenue, tol);
      checks.push({
        key: 'pl_revenue_breakdown',
        status: revMatch ? STATUS_PASS : STATUS_FAIL,
        message: revMatch
          ? 'Pl-pack revenue equals sum(MonthlyRevenueBreakdown) for month'
          : 'Pl-pack revenue does not match sum(MonthlyRevenueBreakdown) for month',
        expected: packRevenue,
        actual: sumRevenue
      });
      const expMatch = withinTolerance(packExpenses, sumExpenses, tol);
      checks.push({
        key: 'pl_expenses_breakdown',
        status: expMatch ? STATUS_PASS : STATUS_FAIL,
        message: expMatch
          ? 'Pl-pack expenses equal sum(MonthlyExpenseBreakdown) for month'
          : 'Pl-pack expenses do not match sum(MonthlyExpenseBreakdown) for month',
        expected: packExpenses,
        actual: sumExpenses
      });
    }

    // --- Inventory consistency: summary inventory_total == sum(inventory ledgers) for month ---
    const summaryForInv = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month },
      attributes: ['inventoryTotal'],
      raw: true
    });
    const inventoryFromSummary = toNum(summaryForInv?.inventoryTotal ?? summaryForInv?.inventory_total);
    const [invCount, invSumRow] = await Promise.all([
      LedgerMonthlyBalance.count({ where: { companyId, monthKey: month, cfoCategory: 'inventory' } }),
      LedgerMonthlyBalance.findAll({
        where: { companyId, monthKey: month, cfoCategory: 'inventory' },
        attributes: [[Sequelize.fn('SUM', Sequelize.col('balance')), 'total']],
        raw: true
      })
    ]);
    const inventoryFromLedgers = toNum(invSumRow?.[0]?.total);
    if (invCount === 0 && inventoryFromSummary === 0) {
      checks.push({ key: 'inventory_consistency', status: STATUS_PASS, message: 'No inventory ledgers; summary inventory is zero' });
    } else if (invCount === 0) {
      checks.push({ key: 'inventory_consistency', status: STATUS_WARN, message: 'No inventory ledgers to reconcile; summary inventory_total may be from snapshot', expected: inventoryFromSummary, actual: null });
    } else {
      const invMatch = withinTolerance(inventoryFromSummary, inventoryFromLedgers, tol);
      checks.push({
        key: 'inventory_consistency',
        status: invMatch ? STATUS_PASS : STATUS_FAIL,
        message: invMatch
          ? 'Summary inventory_total equals sum of inventory-account balances'
          : 'Summary inventory_total does not match sum of inventory-account balances',
        expected: inventoryFromSummary,
        actual: inventoryFromLedgers
      });
    }

    // --- C) YTD consistency: pl-pack ytd vs sum(monthly summary in YTD range) ---
    const fyStart = pack ? plPackService.getFyStartMonthKey(month) : null;
    if (pack && fyStart) {
        const ytdRows = await MonthlyTrialBalanceSummary.findAll({
          where: { companyId, month: { [Sequelize.Op.gte]: fyStart, [Sequelize.Op.lte]: month } },
          attributes: ['totalRevenue', 'totalExpenses', 'netProfit'],
          raw: true
        });
        let ytdRev = 0;
        let ytdExp = 0;
        let ytdNet = 0;
        for (const r of ytdRows) {
          ytdRev += toNum(r.totalRevenue);
          ytdExp += toNum(r.totalExpenses);
          ytdNet += toNum(r.netProfit);
        }
        const ytdRevMatch = withinTolerance(pack.ytd?.totalRevenue ?? 0, ytdRev, tol);
        const ytdExpMatch = withinTolerance(pack.ytd?.totalExpenses ?? 0, ytdExp, tol);
        const ytdNetMatch = withinTolerance(pack.ytd?.netProfit ?? 0, ytdNet, tol);
        checks.push({
          key: 'ytd_current_fy',
          status: ytdRevMatch && ytdExpMatch && ytdNetMatch ? STATUS_PASS : STATUS_FAIL,
          message: ytdRevMatch && ytdExpMatch && ytdNetMatch
            ? 'YTD current FY (revenue, expenses, net profit) reconciles with sum of monthly summary'
            : 'YTD current FY does not match sum of monthly summary for range',
          expected: [pack.ytd?.totalRevenue ?? 0, pack.ytd?.totalExpenses ?? 0, pack.ytd?.netProfit ?? 0],
          actual: [ytdRev, ytdExp, ytdNet]
        });
    }

    const lastFyPeriod = pack ? plPackService.getLastFySamePeriod(month) : { start: null, end: null };
    const { start: lastFyStart, end: lastFyEnd } = lastFyPeriod;
    if (pack && lastFyStart && lastFyEnd) {
        const lastFyRows = await MonthlyTrialBalanceSummary.findAll({
          where: { companyId, month: { [Sequelize.Op.gte]: lastFyStart, [Sequelize.Op.lte]: lastFyEnd } },
          attributes: ['totalRevenue', 'totalExpenses', 'netProfit'],
          raw: true
        });
        let lfyRev = 0;
        let lfyExp = 0;
        let lfyNet = 0;
        for (const r of lastFyRows) {
          lfyRev += toNum(r.totalRevenue);
          lfyExp += toNum(r.totalExpenses);
          lfyNet += toNum(r.netProfit);
        }
        const lfyRevMatch = withinTolerance(pack.ytdLastFy?.totalRevenue ?? 0, lfyRev, tol);
        const lfyExpMatch = withinTolerance(pack.ytdLastFy?.totalExpenses ?? 0, lfyExp, tol);
        const lfyNetMatch = withinTolerance(pack.ytdLastFy?.netProfit ?? 0, lfyNet, tol);
        checks.push({
          key: 'ytd_last_fy',
          status: lfyRevMatch && lfyExpMatch && lfyNetMatch ? STATUS_PASS : STATUS_FAIL,
          message: lfyRevMatch && lfyExpMatch && lfyNetMatch
            ? 'YTD last FY same period reconciles with sum of monthly summary'
            : 'YTD last FY same period does not match sum of monthly summary',
          expected: [pack.ytdLastFy?.totalRevenue ?? 0, pack.ytdLastFy?.totalExpenses ?? 0, pack.ytdLastFy?.netProfit ?? 0],
          actual: [lfyRev, lfyExp, lfyNet]
        });
    }

    // --- D) Month availability: pl-months list matches months in MonthlyTrialBalanceSummary ---
    const plMonthsResult = await plPackService.getPlMonths(companyId);
    const summaryMonths = await MonthlyTrialBalanceSummary.findAll({
      where: { companyId },
      attributes: ['month'],
      raw: true
    });
    const distinctMonths = [...new Set(summaryMonths.map((r) => r.month))].sort();
    const apiMonths = (plMonthsResult?.months || []).slice().sort();
    const monthsMatch =
      distinctMonths.length === apiMonths.length &&
      distinctMonths.every((m, i) => m === apiMonths[i]);
    checks.push({
      key: 'month_availability',
      status: monthsMatch ? STATUS_PASS : STATUS_FAIL,
      message: monthsMatch
        ? 'Pl-months list matches months in MonthlyTrialBalanceSummary'
        : 'Pl-months list does not match months in MonthlyTrialBalanceSummary',
      expected: distinctMonths.length,
      actual: apiMonths.length
    });
  } catch (err) {
    checks.push({ key: 'run_checks', status: STATUS_FAIL, message: `Validator error: ${err.message}` });
  }

  return {
    month: monthKey,
    checks,
    tolerance: tol
  };
};

module.exports = {
  runChecks,
  withinTolerance,
  STATUS_PASS,
  STATUS_WARN,
  STATUS_FAIL,
  DEFAULT_AMOUNT_TOLERANCE,
  DEFAULT_PCT_TOLERANCE
};
