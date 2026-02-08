const { Sequelize } = require('sequelize');
const { AIInsight } = require('../models');
const dashboardService = require('./dashboardService');
const debtorsService = require('./debtorsService');
const creditorsService = require('./creditorsService');
const cfoQuestionService = require('./cfoQuestionService');

const SYSTEM_PROMPT = `You are a conservative CFO and Chartered Accountant advising Indian SMEs.
Use only the provided company data.
Make no assumptions or extrapolations.
Explain your logic step-by-step.
Provide structured, actionable recommendations.
Never hallucinate numbers or make up data.`;

const severityToRisk = (severity) => {
  if (severity === 'critical') return 'RED';
  if (severity === 'warning') return 'AMBER';
  if (severity === 'good') return 'GREEN';
  return 'BLUE';
};

const generateInsights = async (companyId) => {
  if (!dashboardService || typeof dashboardService.getCFOOverview !== 'function') {
    throw new Error('dashboardService not initialized correctly');
  }
  const insights = await cfoQuestionService.getAutoInsights(companyId);

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

  return insights;
};

const getInsights = async (companyId) => {
  // Generate new insights
  await generateInsights(companyId);

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
  // Get context data
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

  return {
    message: result.message,
    matched: true,
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
