const { Sequelize } = require('sequelize');
const { AIInsight } = require('../models');
const dashboardService = require('./dashboardService');
const debtorsService = require('./debtorsService');
const creditorsService = require('./creditorsService');
const cfoQuestionService = require('./cfoQuestionService');
const cfoContextService = require('./cfoContextService');
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

const severityToRisk = (severity) => {
  if (severity === 'critical') return 'RED';
  if (severity === 'warning') return 'AMBER';
  if (severity === 'good') return 'GREEN';
  return 'BLUE';
};

const buildDeterministicAlerts = (context) => {
  if (!context) return [];
  const alerts = [];
  const revenueTrend = context.revenue_trend || [];
  const expenseTrend = context.expense_trend || [];
  const latestRevenue = revenueTrend[revenueTrend.length - 1]?.value ?? 0;
  const prevRevenue = revenueTrend[revenueTrend.length - 2]?.value ?? latestRevenue;
  const latestExpense = expenseTrend[expenseTrend.length - 1]?.value ?? 0;
  const prevExpense = expenseTrend[expenseTrend.length - 2]?.value ?? latestExpense;
  const revenueGrowth = prevRevenue ? (latestRevenue - prevRevenue) / prevRevenue : 0;
  const expenseGrowth = prevExpense ? (latestExpense - prevExpense) / prevExpense : 0;

  if (context.receivable_days && revenueGrowth < 0.01) {
    alerts.push({
      type: 'RECEIVABLES',
      riskLevel: 'AMBER',
      title: 'Receivables Rising While Revenue Flat',
      content: 'Receivables appear elevated while revenue growth is flat.',
      explanation: 'Collections may be slowing compared to revenue momentum.',
      recommendations: ['Review ageing buckets', 'Follow up on overdue invoices']
    });
  }

  if (expenseGrowth > revenueGrowth) {
    alerts.push({
      type: 'MARGIN',
      riskLevel: 'AMBER',
      title: 'Expense Growth Exceeds Revenue Growth',
      content: 'Expenses are rising faster than revenue, pressuring margins.',
      explanation: 'Cost growth is outpacing revenue growth in the latest closed month.',
      recommendations: ['Review discretionary spend', 'Identify cost drivers']
    });
  }

  const topDebtor = context.top_debtors?.[0];
  if (topDebtor && topDebtor.share_percent > 25) {
    alerts.push({
      type: 'DEBTORS',
      riskLevel: 'AMBER',
      title: 'High Debtor Concentration',
      content: 'Top debtor exceeds 25% of receivables.',
      explanation: 'High concentration increases collection risk.',
      recommendations: ['Diversify receivables', 'Negotiate payment terms']
    });
  }

  if (context.runway_months !== null && context.runway_months !== undefined && context.runway_months < 3) {
    alerts.push({
      type: 'RUNWAY',
      riskLevel: 'RED',
      title: 'Cash Runway Below 3 Months',
      content: 'Runway is under 3 months based on latest metrics.',
      explanation: 'Immediate attention required to preserve liquidity.',
      recommendations: ['Reduce burn', 'Accelerate collections', 'Delay nonessential spend']
    });
  }

  return alerts;
};

const generateInsights = async (companyId) => {
  if (!dashboardService || typeof dashboardService.getCFOOverview !== 'function') {
    throw new Error('dashboardService not initialized correctly');
  }
  const insights = await cfoQuestionService.getAutoInsights(companyId);
  const context = process.env.CFO_CONTEXT_ENABLED === 'true'
    ? await cfoContextService.buildContext(companyId)
    : null;
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
        dataPoints: {}
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
  const rewritten = await rewriteMessageIfEnabled(result.message, {
    code: result.code,
    severity: result.severity,
    metrics: result.metrics,
    context
  });

  return {
    message: rewritten,
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
