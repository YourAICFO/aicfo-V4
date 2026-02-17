const { Sequelize } = require('sequelize');
const { AIInsight } = require('../models');
const dashboardService = require('./dashboardService');
const cfoQuestionService = require('./cfoQuestionService');
const cfoContextService = require('./cfoContextService');
const adminUsageService = require('./adminUsageService');
let OpenAI;
if (process.env.OPENAI_API_KEY) {
  try {
    OpenAI = require('openai');
  } catch (error) {
    OpenAI = null;
  }
}

const SYSTEM_PROMPT = `You are a conservative CFO and Chartered Accountant advising Indian SMEs.
Use only the provided company data.
Make no assumptions or extrapolations.
Explain your logic step-by-step.
Provide structured, actionable recommendations.
Never hallucinate numbers or make up data.`;

const AUTO_INSIGHT_CODES = [
  'CASH_RUNWAY_STATUS',
  'PROFITABILITY_STATUS',
  'REVENUE_GROWTH_3M',
  'EXPENSE_GROWTH_3M',
  'DEBTORS_CONCENTRATION',
  'CREDITORS_PRESSURE'
];

const severityToRisk = (severity) => {
  if (severity === 'critical') return 'RED';
  if (severity === 'warning') return 'AMBER';
  if (severity === 'good') return 'GREEN';
  return 'BLUE';
};

const buildDeterministicAlerts = (context) => {
  if (!context?.alerts || !Array.isArray(context.alerts)) return [];
  return context.alerts.map((alert) => {
    const alertType = alert.alertType || alert.alert_type || 'CFO_ALERT';
    const severity = String(alert.severity || '').toUpperCase();
    return {
      type: alertType,
      riskLevel: ['RED', 'AMBER', 'GREEN', 'BLUE'].includes(severity) ? severity : severityToRisk(alert.severity),
      title: String(alertType).replace(/_/g, ' '),
      content: `Stored CFO alert: ${String(alertType).replace(/_/g, ' ')}`,
      explanation: 'Generated from stored snapshot alert rules.',
      recommendations: [],
      metricsUsedJson: alert.metadata || {}
    };
  });
};

const generateInsights = async (companyId, userId = null) => {
  if (!dashboardService || typeof dashboardService.getCFOOverview !== 'function') {
    throw new Error('dashboardService not initialized correctly');
  }
  const insights = [];
  for (const code of AUTO_INSIGHT_CODES) {
    const result = await cfoQuestionService.answerQuestion(companyId, code);
    if (result?.matched) {
      insights.push(result);
      continue;
    }
    const missingMetricKeys = result?.missing?.metrics || [];
    if (userId && missingMetricKeys.length > 0) {
      await adminUsageService.logMissingMetrics({
        companyId,
        userId,
        question: code,
        detectedQuestionKey: code,
        missingMetricKeys
      });
    }
  }
  const context = process.env.CFO_CONTEXT_ENABLED === 'true'
    ? await cfoContextService.buildContext(companyId)
    : null;
  if (userId && Array.isArray(context?.missingMetrics) && context.missingMetrics.length > 0) {
    await adminUsageService.logMissingMetrics({
      companyId,
      userId,
      question: 'AI_CONTEXT',
      detectedQuestionKey: 'AI_CONTEXT',
      missingMetricKeys: context.missingMetrics
    });
  }
  const deterministicAlerts = buildDeterministicAlerts(context);

  // Save insights to database
  for (const insight of insights) {
    await AIInsight.findOrCreate({
      where: {
        companyId,
        type: (insight.category || 'GENERAL').toUpperCase(),
        riskLevel: severityToRisk(insight.severity),
        title: insight.title,
        created_at: {
          [Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      defaults: {
        companyId,
        type: (insight.category || 'GENERAL').toUpperCase(),
        riskLevel: severityToRisk(insight.severity),
        title: insight.title,
        content: insight.message,
        explanation: insight.message,
        recommendations: [],
        dataPoints: insight.metrics || {}
      }
    });
  }

  for (const alert of deterministicAlerts) {
    await AIInsight.findOrCreate({
      where: {
        companyId,
        type: alert.type,
        riskLevel: alert.riskLevel,
        title: alert.title,
        created_at: {
          [Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      defaults: {
        companyId,
        type: alert.type,
        riskLevel: alert.riskLevel,
        title: alert.title,
        content: alert.content,
        explanation: alert.explanation,
        recommendations: alert.recommendations,
        dataPoints: alert.metricsUsedJson || {}
      }
    });
  }

  return insights;
};

const rewriteMessageIfEnabled = async (message, context) => {
  if (!process.env.OPENAI_API_KEY || process.env.AI_REWRITE_ENABLED !== 'true' || !OpenAI) {
    return message;
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const contextBlock = context ? `\n=== CFO STRUCTURED DATA ===\n${JSON.stringify(context)}\n=== END DATA ===` : '';
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Rewrite the CFO answer in a clear, professional tone. Do not add or change any numbers. Do not add new facts.' },
        { role: 'user', content: `Answer: ${message}${contextBlock}` }
      ]
    });
    const content = response?.choices?.[0]?.message?.content?.trim();
    return content || message;
  } catch (error) {
    return message;
  }
};

const getInsights = async (companyId, userId = null) => {
  // Generate new insights
  await generateInsights(companyId, userId);

  // Return all active insights
  const insights = await AIInsight.findAll({
    where: {
      companyId,
      isDismissed: false
    },
    order: [
      ['risk_level', 'ASC'],
      ['created_at', 'DESC']
    ]
  });

  return insights;
};

const markInsightRead = async (insightId, companyId) => {
  const insight = await AIInsight.findOne({
    where: { id: insightId, companyId }
  });

  if (!insight) {
    throw new Error('Insight not found');
  }

  await insight.update({ isRead: true });
  return { message: 'Insight marked as read' };
};

const dismissInsight = async (insightId, companyId) => {
  const insight = await AIInsight.findOne({
    where: { id: insightId, companyId }
  });

  if (!insight) {
    throw new Error('Insight not found');
  }

  await insight.update({ isDismissed: true });
  return { message: 'Insight dismissed' };
};

const chatWithCFO = async (companyId, message) => {
  if (!dashboardService || typeof dashboardService.getCFOOverview !== 'function') {
    throw new Error('dashboardService not initialized correctly');
  }
  const context = process.env.CFO_CONTEXT_ENABLED === 'true'
    ? await cfoContextService.buildContext(companyId)
    : null;

  if (process.env.CFO_CONTEXT_ENABLED === 'true' && !context) {
    return {
      message: 'CFO context is not available yet. Please sync your accounting data and try again.',
      matched: false
    };
  }

  const code = await cfoQuestionService.mapQuestionCode(message);
  if (!code) {
    const suggestions = await cfoQuestionService.listQuestions();
    return {
      message: 'I can answer CFO questions like cash runway, profitability, revenue growth, expenses, debtors, and creditors. Try asking one of those topics.',
      matched: false,
      suggestions: suggestions.slice(0, 6).map(q => q.title)
    };
  }
  const result = await cfoQuestionService.answerQuestion(companyId, code);
  if (!result?.matched) {
    const missingMetricKeys = result?.missing?.metrics || [];
    const missingMetricMessage = 'This metric isn’t available yet for your company. Please sync data / enable module.';
    return {
      message: missingMetricKeys.length > 0 ? missingMetricMessage : (result?.message || 'Not available yet for this company. Please sync/update data.'),
      matched: false,
      questionCode: result?.code || code,
      severity: result?.severity || 'info',
      metrics: result?.metrics || {},
      missing: result?.missing || { metrics: [], tables: [] },
      context: {
        dataSource: 'company_database',
        timestamp: new Date().toISOString()
      }
    };
  }

  const rewritten = await rewriteMessageIfEnabled(result.message, {
    code: result.code,
    severity: result.severity,
    metrics: result.metrics,
    context
  });

  return {
    message: rewritten,
    matched: Boolean(result?.matched),
    questionCode: result.code,
    severity: result.severity,
    metrics: result.metrics,
    context: {
      dataSource: 'company_database',
      timestamp: new Date().toISOString()
    }
  };
};

module.exports = {
  generateInsights,
  getInsights,
  markInsightRead,
  dismissInsight,
  chatWithCFO,
  SYSTEM_PROMPT
};
