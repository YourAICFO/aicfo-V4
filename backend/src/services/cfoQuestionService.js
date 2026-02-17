const { Sequelize } = require('sequelize');
const {
  CFOQuestion,
  CFOQuestionMetric,
  CFOQuestionRule,
  CFOQuestionResult,
  CFOMetric
} = require('../models');

const AUTO_INSIGHT_CODES = [
  'CASH_RUNWAY_STATUS',
  'PROFITABILITY_STATUS',
  'REVENUE_GROWTH_3M',
  'EXPENSE_GROWTH_3M',
  'DEBTORS_CONCENTRATION',
  'CREDITORS_PRESSURE'
];

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

const getStoredMetricValue = async (companyId, metricKey, timeScope = null) => {
  const where = {
    companyId,
    metricKey,
    ...(timeScope ? { timeScope } : { timeScope: { [Sequelize.Op.ne]: 'month' } })
  };

  const order = timeScope === 'month'
    ? [['month', 'DESC'], ['updatedAt', 'DESC']]
    : [['updatedAt', 'DESC']];

  const cached = await CFOMetric.findOne({ where, order, raw: true });
  if (!cached) return null;
  if (cached.metric_value !== null && cached.metric_value !== undefined) {
    const num = Number(cached.metric_value);
    return Number.isNaN(num) ? null : num;
  }
  if (cached.metric_text !== null && cached.metric_text !== undefined) {
    return cached.metric_text;
  }
  return null;
};

const getMetricsForQuestion = async (companyId, questionId) => {
  const metrics = await CFOQuestionMetric.findAll({
    where: { questionId },
    raw: true
  });
  const result = {};
  const missingMetricKeys = [];
  for (const metric of metrics) {
    const value = await getStoredMetricValue(companyId, metric.metric_key, metric.time_scope);
    result[metric.metric_key] = value;
    if (value === null || value === undefined || value === '') {
      missingMetricKeys.push(metric.metric_key);
    }
  }
  return { metrics: result, missingMetricKeys };
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
  const { metrics, missingMetricKeys } = await getMetricsForQuestion(companyId, question.id);
  if (missingMetricKeys.length > 0) {
    return {
      question,
      severity: 'info',
      metrics,
      matched: false,
      missing: { metrics: missingMetricKeys, tables: [] },
      message: 'Not available yet for this company. Please sync/update data.'
    };
  }
  const rule = await resolveRule(question.id, metrics);
  if (!rule) {
    return {
      question,
      severity: 'info',
      metrics,
      matched: false,
      missing: { metrics: [], tables: [] },
      message: 'Not available yet for this company. Please sync/update data.'
    };
  }
  const severity = rule?.severity || 'info';
  const message = formatTemplate(rule.insight_template, metrics);
  return {
    question,
    severity,
    metrics,
    matched: true,
    missing: { metrics: [], tables: [] },
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
    return { message: 'Question not supported.', code, severity: 'info', matched: false, missing: { metrics: [], tables: [] } };
  }
  await storeQuestionResult(companyId, computed.question.id, {
    code: computed.question.code,
    title: computed.question.title,
    category: computed.question.category,
    severity: computed.severity,
    matched: computed.matched,
    missing: computed.missing,
    metrics: computed.metrics,
    message: computed.message
  });
  return {
    code: computed.question.code,
    title: computed.question.title,
    category: computed.question.category,
    severity: computed.severity,
    matched: computed.matched,
    missing: computed.missing,
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
    if (result && result.code && result.matched) {
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
  if (text.includes('working capital')) return 'WORKING_CAPITAL_Q';
  if (text.includes('cash conversion')) return 'CASH_CONVERSION_Q';
  if (text.includes('volatility')) return 'REV_VOLATILITY';
  if (text.includes('stagnation') || text.includes('flat revenue')) return 'REV_STAGNATION';
  if (text.includes('net margin')) return 'MARGIN_LATEST';
  if (text.includes('margin change')) return 'MARGIN_MOM';
  if (text.includes('avg revenue')) return 'REV_AVG_3M';
  if (text.includes('avg expense')) return 'EXP_AVG_3M';
  if (text.includes('avg profit')) return 'PROFIT_AVG_3M';
  if (text.includes('cash balance')) return 'CASH_BALANCE_LIVE';
  if (text.includes('cashflow') || text.includes('cash flow')) return 'NET_CASHFLOW_3M';
  if (text.includes('runway change')) return 'RUNWAY_CHANGE';
  if (text.includes('debtor days')) return 'DEBTOR_DAYS_Q';
  if (text.includes('creditor days')) return 'CREDITOR_DAYS_Q';
  if (text.includes('expense vs revenue') || text.includes('margin pressure')) return 'EXP_VS_REV_GROWTH';
  if (text.includes('is the business safe') || text.includes('financially safe')) return 'BUSINESS_SAFETY_Q';
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
