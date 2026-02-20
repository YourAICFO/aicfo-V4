const { Sequelize } = require('sequelize');
const {
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  PLRemarks
} = require('../models');
const { getMonthKeyOffset } = require('../utils/monthKeyUtils');
const aiService = require('./aiService');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Previous month key from YYYY-MM */
const prevMonthKey = (monthKey) => getMonthKeyOffset(monthKey, -1);

/** Indian FY: Apr–Mar. Returns FY start month key (e.g. 2025-04 for 2025-06, 2024-04 for 2025-02). */
const getFyStartMonthKey = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [y, m] = monthKey.split('-').map(Number);
  if (m >= 4) return `${y}-04`;
  return `${y - 1}-04`;
};

/** Same period in prior FY: { start, end } month keys. Uses year/month arithmetic to avoid timezone issues. */
const getLastFySamePeriod = (monthKey) => {
  const fyStart = getFyStartMonthKey(monthKey);
  if (!fyStart || !monthKey) return { start: null, end: null };
  const [fyY, fyM] = fyStart.split('-').map(Number);
  const [endY, endM] = monthKey.split('-').map(Number);
  const pad = (m) => String(m).padStart(2, '0');
  return {
    start: `${fyY - 1}-${pad(fyM)}`,
    end: `${endY - 1}-${pad(endM)}`
  };
};

/** Safe % change: (curr - prev) / prev * 100. Returns null when prev is 0 or not finite (display as "—"). */
const safePctChange = (prev, curr) => {
  const p = Number(prev);
  const c = Number(curr);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p === 0) return null;
  return ((c - p) / p) * 100;
};

/** Build topPositive / topNegative from line-item deltas. Each item: { key, label, amount } where amount is the MoM delta. */
const buildDriverLists = (deltas, limit = 5) => {
  const withDelta = Object.entries(deltas)
    .filter(([, delta]) => delta !== 0)
    .map(([key, delta]) => ({ key, label: key, amount: delta }));
  const byAbs = (a, b) => Math.abs(b.amount) - Math.abs(a.amount);
  const positive = withDelta.filter((x) => x.amount > 0).sort(byAbs).slice(0, limit);
  const negative = withDelta.filter((x) => x.amount < 0).sort(byAbs).slice(0, limit);
  return { topPositive: positive, topNegative: negative };
};

/**
 * Deterministic P&L Pack for a given month: totals, variances vs previous month, YTD, and drivers.
 * Drivers use revenue/expense breakdowns when available; otherwise only summary-level deltas (documented limitation).
 */
const getPlPackWithDrivers = async (companyId, monthKey) => {
  const prev = prevMonthKey(monthKey);
  const [currSummary, prevSummary, currRevenueRows, prevRevenueRows, currExpenseRows, prevExpenseRows] = await Promise.all([
    MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: monthKey }, raw: true }),
    prev ? MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: prev }, raw: true }) : null,
    MonthlyRevenueBreakdown.findAll({ where: { companyId, month: monthKey }, raw: true }),
    prev ? MonthlyRevenueBreakdown.findAll({ where: { companyId, month: prev }, raw: true }) : [],
    MonthlyExpenseBreakdown.findAll({ where: { companyId, month: monthKey }, raw: true }),
    prev ? MonthlyExpenseBreakdown.findAll({ where: { companyId, month: prev }, raw: true }) : []
  ]);

  const currRev = toNum(currSummary?.totalRevenue);
  const prevRev = toNum(prevSummary?.totalRevenue);
  const currExp = toNum(currSummary?.totalExpenses);
  const prevExp = toNum(prevSummary?.totalExpenses);
  const currNet = toNum(currSummary?.netProfit);
  const prevNet = toNum(prevSummary?.netProfit);

  const revenueDelta = currRev - prevRev;
  const opexDelta = currExp - prevExp;
  const netProfitDelta = currNet - prevNet;
  const grossProfitCurr = currRev;
  const grossProfitPrev = prevRev;
  const grossProfitDelta = grossProfitCurr - grossProfitPrev;

  const revenueByKey = {};
  for (const r of currRevenueRows) {
    const k = r.normalizedRevenueCategory || r.revenueName || 'Revenue';
    if (!revenueByKey[k]) revenueByKey[k] = { curr: 0, prev: 0 };
    revenueByKey[k].curr += toNum(r.amount);
  }
  for (const r of prevRevenueRows) {
    const k = r.normalizedRevenueCategory || r.revenueName || 'Revenue';
    if (!revenueByKey[k]) revenueByKey[k] = { curr: 0, prev: 0 };
    revenueByKey[k].prev += toNum(r.amount);
  }
  const revenueDeltas = {};
  for (const [key, v] of Object.entries(revenueByKey)) {
    const delta = v.curr - v.prev;
    if (delta !== 0) revenueDeltas[key] = delta;
  }
  const revenueDrivers = buildDriverLists(revenueDeltas);

  const expenseByKey = {};
  for (const r of currExpenseRows) {
    const k = r.normalizedExpenseCategory || r.expenseName || 'Expense';
    if (!expenseByKey[k]) expenseByKey[k] = { curr: 0, prev: 0 };
    expenseByKey[k].curr += toNum(r.amount);
  }
  for (const r of prevExpenseRows) {
    const k = r.normalizedExpenseCategory || r.expenseName || 'Expense';
    if (!expenseByKey[k]) expenseByKey[k] = { curr: 0, prev: 0 };
    expenseByKey[k].prev += toNum(r.amount);
  }
  const expenseDeltas = {};
  for (const [key, v] of Object.entries(expenseByKey)) {
    const delta = v.curr - v.prev;
    if (delta !== 0) expenseDeltas[key] = delta;
  }
  const opexDrivers = buildDriverLists(expenseDeltas);

  const drivers = {
    revenue: {
      deltaAmount: revenueDelta,
      topPositive: revenueDrivers.topPositive,
      topNegative: revenueDrivers.topNegative
    },
    opex: {
      deltaAmount: opexDelta,
      topPositive: opexDrivers.topPositive,
      topNegative: opexDrivers.topNegative
    },
    grossProfit: {
      deltaAmount: grossProfitDelta,
      topPositive: revenueDrivers.topPositive,
      topNegative: revenueDrivers.topNegative
    },
    netProfit: {
      deltaAmount: netProfitDelta,
      topPositive: netProfitDelta > 0 ? [{ key: 'net_profit', label: 'Net Profit', amount: netProfitDelta }] : [],
      topNegative: netProfitDelta < 0 ? [{ key: 'net_profit', label: 'Net Profit', amount: netProfitDelta }] : []
    }
  };

  const fyStart = getFyStartMonthKey(monthKey);
  let ytdRevenue = 0;
  let ytdExpenses = 0;
  let ytdGrossProfit = 0;
  let ytdNetProfit = 0;
  if (fyStart && monthKey) {
    const ytdRows = await MonthlyTrialBalanceSummary.findAll({
      where: {
        companyId,
        month: { [Sequelize.Op.gte]: fyStart, [Sequelize.Op.lte]: monthKey }
      },
      attributes: ['totalRevenue', 'totalExpenses', 'netProfit'],
      raw: true
    });
    for (const r of ytdRows) {
      ytdRevenue += toNum(r.totalRevenue);
      ytdExpenses += toNum(r.totalExpenses);
      ytdNetProfit += toNum(r.netProfit);
    }
    ytdGrossProfit = ytdRevenue;
  }

  const { start: lastFyStart, end: lastFyEnd } = getLastFySamePeriod(monthKey);
  let ytdLastFyRevenue = 0;
  let ytdLastFyExpenses = 0;
  let ytdLastFyGrossProfit = 0;
  let ytdLastFyNetProfit = 0;
  if (lastFyStart && lastFyEnd) {
    const lastFyRows = await MonthlyTrialBalanceSummary.findAll({
      where: {
        companyId,
        month: { [Sequelize.Op.gte]: lastFyStart, [Sequelize.Op.lte]: lastFyEnd }
      },
      attributes: ['totalRevenue', 'totalExpenses', 'netProfit'],
      raw: true
    });
    for (const r of lastFyRows) {
      ytdLastFyRevenue += toNum(r.totalRevenue);
      ytdLastFyExpenses += toNum(r.totalExpenses);
      ytdLastFyNetProfit += toNum(r.netProfit);
    }
    ytdLastFyGrossProfit = ytdLastFyRevenue;
  }

  const ytdVarianceRevenue = ytdRevenue - ytdLastFyRevenue;
  const ytdVarianceExpenses = ytdExpenses - ytdLastFyExpenses;
  const ytdVarianceGrossProfit = ytdGrossProfit - ytdLastFyGrossProfit;
  const ytdVarianceNetProfit = ytdNetProfit - ytdLastFyNetProfit;

  return {
    month: monthKey,
    previousMonth: prev || null,
    current: {
      totalRevenue: currRev,
      totalExpenses: currExp,
      grossProfit: grossProfitCurr,
      netProfit: currNet
    },
    previous: {
      totalRevenue: prevRev,
      totalExpenses: prevExp,
      grossProfit: grossProfitPrev,
      netProfit: prevNet
    },
    variances: {
      revenue: revenueDelta,
      opex: opexDelta,
      grossProfit: grossProfitDelta,
      netProfit: netProfitDelta,
      revenuePct: safePctChange(prevRev, currRev),
      opexPct: safePctChange(prevExp, currExp),
      grossProfitPct: safePctChange(grossProfitPrev, grossProfitCurr),
      netProfitPct: safePctChange(prevNet, currNet)
    },
    ytd: {
      totalRevenue: ytdRevenue,
      totalExpenses: ytdExpenses,
      grossProfit: ytdGrossProfit,
      netProfit: ytdNetProfit
    },
    ytdLastFy: {
      totalRevenue: ytdLastFyRevenue,
      totalExpenses: ytdLastFyExpenses,
      grossProfit: ytdLastFyGrossProfit,
      netProfit: ytdLastFyNetProfit
    },
    ytdVarianceAmount: {
      revenue: ytdVarianceRevenue,
      expenses: ytdVarianceExpenses,
      grossProfit: ytdVarianceGrossProfit,
      netProfit: ytdVarianceNetProfit
    },
    ytdVariancePct: {
      revenue: safePctChange(ytdLastFyRevenue, ytdRevenue),
      expenses: safePctChange(ytdLastFyExpenses, ytdExpenses),
      grossProfit: safePctChange(ytdLastFyGrossProfit, ytdGrossProfit),
      netProfit: safePctChange(ytdLastFyNetProfit, ytdNetProfit)
    },
    drivers
  };
};

/** GET available months for P&L (company has snapshot data). Returns { months: [YYYY-MM desc], latest }. */
const getPlMonths = async (companyId) => {
  const rows = await MonthlyTrialBalanceSummary.findAll({
    where: { companyId },
    attributes: ['month'],
    order: [['month', 'DESC']],
    raw: true
  });
  const months = [...new Set(rows.map((r) => r.month))];
  return { months, latest: months[0] || null };
};

/** GET remarks for company+month */
const getRemarks = async (companyId, monthKey) => {
  const row = await PLRemarks.findOne({
    where: { companyId, month: monthKey },
    attributes: ['text', 'aiDraftText', 'aiDraftUpdatedAt', 'updatedBy', 'updatedAt'],
    raw: true
  });
  if (!row) {
    return { text: null, aiDraftText: null, updatedAt: null, updatedBy: null, aiDraftUpdatedAt: null };
  }
  return {
    text: row.text ?? null,
    aiDraftText: row.aiDraftText ?? null,
    updatedAt: row.updatedAt ?? null,
    updatedBy: row.updatedBy ?? null,
    aiDraftUpdatedAt: row.aiDraftUpdatedAt ?? null
  };
};

/** Upsert manual remarks (POST) */
const upsertRemarks = async (companyId, monthKey, text, updatedBy = null) => {
  const [row] = await PLRemarks.findOrCreate({
    where: { companyId, month: monthKey },
    defaults: { companyId, month: monthKey, text: text ?? null, updatedBy }
  });
  await row.update({ text: text ?? null, updatedBy });
  return { text: row.text, updatedAt: row.updatedAt };
};

const PL_AI_COOLDOWN_MS = 10000;
const plAiLastCall = new Map();

/** Per-user cooldown for pl-ai-explanation */
const checkPlAiCooldown = (userId) => {
  const key = userId || 'anon';
  const last = plAiLastCall.get(key);
  if (last && Date.now() - last < PL_AI_COOLDOWN_MS) return false;
  plAiLastCall.set(key, Date.now());
  return true;
};

/**
 * Get or create AI explanation for P&L Pack. If cached and !forceRegenerate, return cache; else load pack, generate, save, return.
 */
const getOrCreateAiExplanation = async (companyId, monthKey, options = {}) => {
  const { forceRegenerate = false, userId = null } = options;
  let row = await PLRemarks.findOne({ where: { companyId, month: monthKey } });
  if (!row) {
    row = await PLRemarks.create({ companyId, month: monthKey });
  }
  if (row.aiDraftText && !forceRegenerate) {
    return { aiDraftText: row.aiDraftText, aiDraftUpdatedAt: row.aiDraftUpdatedAt };
  }
  if (!checkPlAiCooldown(userId)) {
    throw new Error('Please wait a moment before generating again.');
  }
  const pack = await getPlPackWithDrivers(companyId, monthKey);
  const structuredData = {
    month: pack.month,
    previousMonth: pack.previousMonth,
    current: pack.current,
    previous: pack.previous,
    variances: pack.variances,
    ytd: pack.ytd,
    ytdLastFy: pack.ytdLastFy,
    ytdVarianceAmount: pack.ytdVarianceAmount,
    ytdVariancePct: pack.ytdVariancePct,
    drivers: pack.drivers
  };
  const aiDraftText = await aiService.generatePlPackNarrative(structuredData);
  const aiDraftUpdatedAt = new Date();
  await row.update({ aiDraftText, aiDraftUpdatedAt });
  return { aiDraftText, aiDraftUpdatedAt };
};

module.exports = {
  getPlPackWithDrivers,
  getPlMonths,
  getRemarks,
  upsertRemarks,
  getOrCreateAiExplanation,
  prevMonthKey,
  buildDriverLists,
  getFyStartMonthKey,
  getLastFySamePeriod,
  safePctChange
};
