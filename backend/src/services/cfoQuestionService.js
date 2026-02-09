const { Sequelize } = require('sequelize');
const {
  CFOQuestion,
  CFOQuestionMetric,
  CFOQuestionRule,
  CFOQuestionResult,
  CFOMetric,
  MonthlyTrialBalanceSummary,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CurrentLiquidityMetric
} = require('../models');
const { getLatestClosedMonthKey, listMonthKeysBetween } = require('./monthlySnapshotService');
const debtorsService = require('./debtorsService');
const creditorsService = require('./creditorsService');

const AUTO_INSIGHT_CODES = [
  'CASH_RUNWAY_STATUS',
  'PROFITABILITY_STATUS',
  'REVENUE_GROWTH_3M',
  'EXPENSE_GROWTH_3M',
  'DEBTORS_CONCENTRATION',
  'CREDITORS_PRESSURE'
];

const addMonths = (monthKey, delta) => {
  if (!monthKey) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const num = Number(value);
  if (Number.isNaN(num)) return 'N/A';
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toFixed(digits);
};

const formatMetricValue = (key, value) => {
  if (value === null || value === undefined) return 'N/A';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  if (key.includes('ratio') || key.includes('growth')) {
    return `${(num * 100).toFixed(1)}%`;
  }
  if (key.includes('month')) {
    return formatNumber(num, 1);
  }
  return formatNumber(num, 0);
};

const formatTemplate = (template, metrics) => {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key) => {
    return formatMetricValue(key, metrics[key]);
  });
};

const evaluateCondition = (condition, metrics) => {
  if (!condition || typeof condition !== 'object') return false;
  return Object.entries(condition).every(([metricKey, rule]) => {
    const value = metrics[metricKey];
    if (rule && typeof rule === 'object') {
      if (Object.prototype.hasOwnProperty.call(rule, 'lt')) return Number(value) < Number(rule.lt);
      if (Object.prototype.hasOwnProperty.call(rule, 'lte')) return Number(value) <= Number(rule.lte);
      if (Object.prototype.hasOwnProperty.call(rule, 'gt')) return Number(value) > Number(rule.gt);
      if (Object.prototype.hasOwnProperty.call(rule, 'gte')) return Number(value) >= Number(rule.gte);
      if (Object.prototype.hasOwnProperty.call(rule, 'eq')) return value === rule.eq;
      if (Object.prototype.hasOwnProperty.call(rule, 'neq')) return value !== rule.neq;
      if (Object.prototype.hasOwnProperty.call(rule, 'between')) {
        const [min, max] = rule.between;
        return Number(value) >= Number(min) && Number(value) <= Number(max);
      }
    }
    return false;
  });
};

const getLatestClosedMonths = (count) => {
  const latest = getLatestClosedMonthKey();
  if (!latest) return [];
  const start = addMonths(latest, -(count - 1));
  return listMonthKeysBetween(start, latest);
};

const getSummariesForMonths = async (companyId, months) => {
  if (!months.length) return [];
  const rows = await MonthlyTrialBalanceSummary.findAll({
    where: {
      companyId,
      month: { [Sequelize.Op.in]: months }
    },
    raw: true
  });
  const map = new Map(rows.map(r => [r.month, r]));
  return months.map(m => map.get(m)).filter(Boolean);
};

const getMetricValue = async (companyId, metricKey) => {
  switch (metricKey) {
    case 'cash_balance_live': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const rows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true });
      return rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    }
    case 'debtors_balance_live': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const rows = await CurrentDebtor.findAll({ where: { companyId }, raw: true });
      return rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    }
    case 'creditors_balance_live': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const rows = await CurrentCreditor.findAll({ where: { companyId }, raw: true });
      return rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    }
    case 'loans_balance_live': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const rows = await CurrentLoan.findAll({ where: { companyId }, raw: true });
      return rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    }
    case 'cash_runway_months': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const metric = await CurrentLiquidityMetric.findOne({ where: { companyId }, raw: true });
      return metric ? Number(metric.cash_runway_months || 0) : 0;
    }
    case 'avg_net_cash_outflow_3m': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: '3m' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const metric = await CurrentLiquidityMetric.findOne({ where: { companyId }, raw: true });
      return metric ? Number(metric.avg_net_cash_outflow_3m || 0) : 0;
    }
    case 'revenue_last_closed': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'last_closed_month' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const latest = getLatestClosedMonthKey();
      if (!latest) return 0;
      const row = await MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: latest }, raw: true });
      return row ? Number(row.total_revenue || 0) : 0;
    }
    case 'expenses_last_closed': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'last_closed_month' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const latest = getLatestClosedMonthKey();
      if (!latest) return 0;
      const row = await MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: latest }, raw: true });
      return row ? Number(row.total_expenses || 0) : 0;
    }
    case 'net_profit_last_closed': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'last_closed_month' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const latest = getLatestClosedMonthKey();
      if (!latest) return 0;
      const row = await MonthlyTrialBalanceSummary.findOne({ where: { companyId, month: latest }, raw: true });
      return row ? Number(row.net_profit || 0) : 0;
    }
    case 'revenue_growth_3m': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: '3m' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const latest = getLatestClosedMonthKey();
      if (!latest) return 0;
      const recentMonths = getLatestClosedMonths(3);
      const prevMonths = listMonthKeysBetween(addMonths(latest, -5), addMonths(latest, -3));
      const recent = await getSummariesForMonths(companyId, recentMonths);
      const prev = await getSummariesForMonths(companyId, prevMonths);
      const recentAvg = recent.length
        ? recent.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / recent.length
        : 0;
      const prevAvg = prev.length
        ? prev.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) / prev.length
        : 0;
      if (prevAvg === 0) return 0;
      return (recentAvg - prevAvg) / prevAvg;
    }
    case 'expense_growth_3m': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: '3m' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const latest = getLatestClosedMonthKey();
      if (!latest) return 0;
      const recentMonths = getLatestClosedMonths(3);
      const prevMonths = listMonthKeysBetween(addMonths(latest, -5), addMonths(latest, -3));
      const recent = await getSummariesForMonths(companyId, recentMonths);
      const prev = await getSummariesForMonths(companyId, prevMonths);
      const recentAvg = recent.length
        ? recent.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / recent.length
        : 0;
      const prevAvg = prev.length
        ? prev.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) / prev.length
        : 0;
      if (prevAvg === 0) return 0;
      return (recentAvg - prevAvg) / prevAvg;
    }
    case 'debtors_concentration_ratio': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value);
      const rows = await CurrentDebtor.findAll({ where: { companyId }, order: [['balance', 'DESC']], raw: true });
      const total = rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
      const top5 = rows.slice(0, 5).reduce((sum, r) => sum + Number(r.balance || 0), 0);
      return total > 0 ? top5 / total : 0;
    }
    case 'creditors_cash_pressure': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'live' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value) > 0;
      const creditors = await CurrentCreditor.findAll({ where: { companyId }, raw: true });
      const cashRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true });
      const totalCreditors = creditors.reduce((sum, r) => sum + Number(r.balance || 0), 0);
      const totalCash = cashRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
      return totalCreditors > totalCash;
    }
    case 'debtors_revenue_divergence': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'last_closed_month' }, raw: true });
      if (cached && cached.metric_value !== null) return Number(cached.metric_value) > 0;
      const summary = await debtorsService.getSummary(companyId);
      return Boolean(summary?.divergenceFlag);
    }
    case 'revenue_yoy_growth_pct':
    case 'expense_yoy_growth_pct':
    case 'net_profit_yoy_growth_pct':
    case 'gross_margin_yoy_growth_pct': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'yoy' }, raw: true });
      return cached && cached.metric_value !== null ? Number(cached.metric_value) : null;
    }
    case 'cash_balance_yoy_change':
    case 'debtor_balance_yoy_change':
    case 'creditor_balance_yoy_change': {
      const cached = await CFOMetric.findOne({ where: { companyId, metricKey: metricKey, timeScope: 'yoy' }, raw: true });
      return cached && cached.metric_value !== null ? Number(cached.metric_value) : null;
    }
    default:
      return null;
  }
};

const getMetricsForQuestion = async (companyId, questionId) => {
  const metrics = await CFOQuestionMetric.findAll({
    where: { questionId },
    raw: true
  });
  const result = {};
  const latestClosedKey = getLatestClosedMonthKey();
  const lastYearKey = latestClosedKey ? addMonths(latestClosedKey, -12) : null;
  result.month = latestClosedKey || null;
  result.month_last_year = lastYearKey || null;
  for (const metric of metrics) {
    result[metric.metric_key] = await getMetricValue(companyId, metric.metric_key);
  }
  return result;
};

const resolveRule = async (questionId, metrics) => {
  const rules = await CFOQuestionRule.findAll({
    where: { questionId },
    order: [['created_at', 'ASC']],
    raw: true
  });
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, metrics)) {
      return rule;
    }
  }
  return null;
};

const computeQuestionResult = async (companyId, code) => {
  const question = await CFOQuestion.findOne({ where: { code, enabled: true }, raw: true });
  if (!question) {
    return null;
  }
  const metrics = await getMetricsForQuestion(companyId, question.id);
  const rule = await resolveRule(question.id, metrics);
  const severity = rule?.severity || 'info';
  const message = rule ? formatTemplate(rule.insight_template, metrics) : 'Not enough data to answer this question.';
  return {
    question,
    severity,
    metrics,
    message
  };
};

const storeQuestionResult = async (companyId, questionId, payload) => {
  const record = {
    companyId,
    questionId,
    severity: payload.severity || 'info',
    result: payload,
    computedAt: new Date()
  };
  await CFOQuestionResult.upsert(record);
  return record;
};

const answerQuestion = async (companyId, code) => {
  const computed = await computeQuestionResult(companyId, code);
  if (!computed) {
    return { message: 'Question not supported.', code, severity: 'info' };
  }
  await storeQuestionResult(companyId, computed.question.id, {
    code: computed.question.code,
    title: computed.question.title,
    category: computed.question.category,
    severity: computed.severity,
    metrics: computed.metrics,
    message: computed.message
  });
  return {
    code: computed.question.code,
    title: computed.question.title,
    category: computed.question.category,
    severity: computed.severity,
    metrics: computed.metrics,
    message: computed.message
  };
};

const listQuestions = async () => {
  return CFOQuestion.findAll({ where: { enabled: true }, order: [['category', 'ASC'], ['title', 'ASC']], raw: true });
};

const getAutoInsights = async (companyId) => {
  const results = [];
  for (const code of AUTO_INSIGHT_CODES) {
    const result = await answerQuestion(companyId, code);
    if (result && result.code) {
      results.push(result);
    }
  }
  return results;
};

const mapQuestionCode = async (message) => {
  const text = (message || '').toLowerCase();
  if (!text) return null;
  if (text.includes('runway') || text.includes('cash burn')) return 'CASH_RUNWAY_STATUS';
  if (text.includes('profit') || text.includes('margin')) return 'PROFITABILITY_STATUS';
  if (text.includes('revenue') || text.includes('sales')) return 'REVENUE_GROWTH_3M';
  if (text.includes('expense') || text.includes('cost')) return 'EXPENSE_GROWTH_3M';
  if (text.includes('debtor') || text.includes('receivable')) return 'DEBTORS_CONCENTRATION';
  if (text.includes('creditor') || text.includes('payable')) return 'CREDITORS_PRESSURE';
  if (text.includes('yoy') || text.includes('year over year') || text.includes('last year')) {
    if (text.includes('revenue') || text.includes('sales')) return 'REVENUE_YOY_TREND';
    if (text.includes('expense') || text.includes('cost')) return 'EXPENSE_YOY_TREND';
    if (text.includes('profit') || text.includes('margin')) return 'PROFIT_YOY_TREND';
    if (text.includes('debtor') || text.includes('receivable')) return 'DEBTOR_YOY_TREND';
    if (text.includes('creditor') || text.includes('payable')) return 'CREDITOR_YOY_TREND';
  }
  return null;
};

const recomputeForCompany = async (companyId) => {
  const questions = await listQuestions();
  for (const q of questions) {
    await answerQuestion(companyId, q.code);
  }
};

module.exports = {
  listQuestions,
  answerQuestion,
  getAutoInsights,
  mapQuestionCode,
  recomputeForCompany
};
