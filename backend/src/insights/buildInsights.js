const { Op, Sequelize } = require('sequelize');
const { CFOMetric, CFOAlert, AIInsight } = require('../models');
const adminUsageService = require('../services/adminUsageService');
const { insightRules, severityRank } = require('./insightsRules');

const RISK_LEVEL_MAP = {
  critical: 'RED',
  high: 'RED',
  medium: 'AMBER',
  low: 'GREEN'
};

const severityWeight = (severity) => severityRank[String(severity || '').toLowerCase()] ?? -1;

const toMetricValue = (row) => {
  if (!row) return null;
  if (row.metric_value !== null && row.metric_value !== undefined) {
    const num = Number(row.metric_value);
    return Number.isFinite(num) ? num : null;
  }
  if (row.metric_text !== null && row.metric_text !== undefined) {
    const num = Number(row.metric_text);
    return Number.isFinite(num) ? num : row.metric_text;
  }
  return null;
};

const collectRequiredMetricKeys = () => {
  const keys = new Set();
  for (const rule of insightRules) {
    for (const key of rule.requiredMetricKeys || []) keys.add(key);
  }
  return Array.from(keys);
};

const pickLatestMetricRows = async (companyId, metricKeys) => {
  if (!metricKeys.length) return new Map();
  const rows = await CFOMetric.findAll({
    where: {
      companyId,
      metricKey: { [Op.in]: metricKeys },
      timeScope: { [Op.ne]: 'month' }
    },
    order: [['metric_key', 'ASC'], ['updated_at', 'DESC']],
    raw: true
  });

  const byKey = new Map();
  for (const row of rows) {
    if (!byKey.has(row.metric_key)) {
      byKey.set(row.metric_key, row);
    }
  }
  return byKey;
};

const buildRuleInsight = (rule, metrics) => {
  const evidence = (rule.evidenceKeys || [])
    .filter((key) => metrics[key] !== null && metrics[key] !== undefined)
    .map((key) => ({ metric_key: key, value: metrics[key] }));

  const severity = String(rule.severity || 'high').toLowerCase();

  return {
    code: rule.code,
    title: rule.title,
    content: rule.title,
    severity,
    priority_rank: rule.priorityRank,
    category: rule.category,
    evidence,
    metricsUsedJson: {
      code: rule.code,
      severity,
      priority_rank: rule.priorityRank,
      evidence,
      required_metric_keys: rule.requiredMetricKeys
    },
    recommended_action: rule.recommendedAction
  };
};

const buildAlertInsights = async (companyId) => {
  const alerts = await CFOAlert.findAll({
    where: { companyId },
    order: [['generated_at', 'DESC']],
    limit: 20,
    raw: true
  });

  return alerts
    .map((alert) => {
      const sevRaw = String(alert.severity || '').toLowerCase();
      const severity = sevRaw === 'red' ? 'critical' : sevRaw === 'amber' ? 'high' : sevRaw === 'green' ? 'low' : sevRaw;
      return {
        code: `CFO_ALERT_${alert.alert_type}`,
        title: `CFO alert: ${String(alert.alert_type || 'RISK').replace(/_/g, ' ')}`,
        content: `Stored alert ${String(alert.alert_type || 'RISK').replace(/_/g, ' ')} is active.`,
        severity,
        priority_rank: severity === 'critical' ? 50 : severity === 'high' ? 60 : 90,
        category: 'RISK',
        evidence: [{ metric_key: 'cfo_alert', value: alert.metadata || {} }],
        metricsUsedJson: {
          code: `CFO_ALERT_${alert.alert_type}`,
          severity,
          priority_rank: severity === 'critical' ? 50 : severity === 'high' ? 60 : 90,
          evidence: [{ metric_key: 'cfo_alert', value: alert.metadata || {} }]
        },
        recommended_action: 'Review and close the underlying risk trigger from the latest sync context.',
        generatedAt: alert.generated_at || new Date()
      };
    })
    .filter((insight) => ['critical', 'high'].includes(insight.severity));
};

const persistInsight = async (companyId, insight) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await AIInsight.findOne({
    where: {
      companyId,
      title: insight.title,
      type: insight.category,
      generatedAt: { [Op.gte]: todayStart }
    }
  });

  const payload = {
    companyId,
    type: insight.category,
    riskLevel: RISK_LEVEL_MAP[insight.severity] || 'AMBER',
    title: insight.title,
    content: insight.content,
    explanation: `Severity: ${insight.severity.toUpperCase()} | Priority: ${insight.priority_rank}`,
    dataPoints: {
      ...(insight.metricsUsedJson || {}),
      severity: insight.severity,
      priority_rank: insight.priority_rank,
      evidence: insight.evidence || []
    },
    recommendations: [insight.recommended_action],
    generatedAt: insight.generatedAt || new Date(),
    isDismissed: false
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return AIInsight.create(payload);
};

const buildInsights = async (companyId, userId = null, opts = {}) => {
  const limit = Number(opts.limit || 10);
  const requiredMetricKeys = collectRequiredMetricKeys();
  const metricRows = await pickLatestMetricRows(companyId, requiredMetricKeys);

  const metricValues = {};
  for (const key of requiredMetricKeys) {
    metricValues[key] = toMetricValue(metricRows.get(key));
  }

  const ruleInsights = [];
  for (const rule of insightRules) {
    const missingMetricKeys = (rule.requiredMetricKeys || []).filter((key) => metricValues[key] === null || metricValues[key] === undefined);
    if (missingMetricKeys.length > 0) {
      if (userId) {
        await adminUsageService.logMissingMetrics({
          companyId,
          userId,
          question: rule.code,
          detectedQuestionKey: rule.code,
          missingMetricKeys
        });
      }
      continue;
    }

    let matched = false;
    try {
      matched = Boolean(rule.condition(metricValues));
    } catch (error) {
      matched = false;
    }
    if (!matched) continue;

    ruleInsights.push(buildRuleInsight(rule, metricValues));
  }

  const alertInsights = await buildAlertInsights(companyId);
  const combined = [...ruleInsights, ...alertInsights]
    .filter((insight) => ['critical', 'high'].includes(String(insight.severity || '').toLowerCase()))
    .sort((a, b) => {
      const sevDelta = severityWeight(b.severity) - severityWeight(a.severity);
      if (sevDelta !== 0) return sevDelta;
      return Number(a.priority_rank || 999) - Number(b.priority_rank || 999);
    })
    .slice(0, limit);

  for (const insight of combined) {
    await persistInsight(companyId, insight);
  }

  await AIInsight.update(
    { isDismissed: true },
    {
      where: {
        companyId,
        generatedAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        isRead: true,
        isDismissed: false
      }
    }
  );

  return combined;
};

module.exports = {
  buildInsights
};
