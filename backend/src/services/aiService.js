const { Sequelize } = require('sequelize');
const { AIInsight } = require('../models');
const dashboardService = require('./dashboardService');
const debtorsService = require('./debtorsService');
const creditorsService = require('./creditorsService');

const SYSTEM_PROMPT = `You are a conservative CFO and Chartered Accountant advising Indian SMEs.
Use only the provided company data.
Make no assumptions or extrapolations.
Explain your logic step-by-step.
Provide structured, actionable recommendations.
Never hallucinate numbers or make up data.`;

const generateInsights = async (companyId) => {
  if (!dashboardService || typeof dashboardService.getCFOOverview !== 'function') {
    throw new Error('dashboardService not initialized correctly');
  }
  const insights = [];

  // Get CFO overview for runway calculation
  const overview = await dashboardService.getCFOOverview(companyId);

  // Runway insight
  if (overview.runway.status === 'RED') {
    insights.push({
      type: 'RUNWAY',
      riskLevel: 'RED',
      title: 'Critical Cash Runway Alert',
      content: `Your cash runway is ${overview.runway.months} months. Immediate action required.`,
      explanation: `Current cash: ₹${overview.cashPosition.currentBalance.toLocaleString()}. ` +
        `Average monthly net cash flow: ₹${overview.runway.netCashFlow.toLocaleString()}. ` +
        `At this rate, you will run out of cash in ${overview.runway.months} months.`,
      recommendations: [
        'Reduce discretionary expenses immediately',
        'Accelerate receivables collection',
        'Consider short-term financing options',
        'Defer non-essential capital expenditures'
      ]
    });
  } else if (overview.runway.status === 'AMBER') {
    insights.push({
      type: 'RUNWAY',
      riskLevel: 'AMBER',
      title: 'Cash Runway Warning',
      content: `Your cash runway is ${overview.runway.months} months. Monitor closely.`,
      explanation: `Current cash: ₹${overview.cashPosition.currentBalance.toLocaleString()}. ` +
        `Average monthly net cash flow: ₹${overview.runway.netCashFlow.toLocaleString()}.`,
      recommendations: [
        'Review expense patterns for optimization',
        'Explore revenue acceleration opportunities',
        'Maintain cash reserves'
      ]
    });
  }

  const debtorsSummary = await debtorsService.getSummary(companyId);
  if (debtorsSummary?.divergenceFlag) {
    insights.push({
      type: 'DEBTORS',
      riskLevel: 'AMBER',
      title: 'Debtors Growing Faster Than Revenue',
      content: 'Debtors are increasing while revenue is not keeping pace.',
      explanation: 'Receivables growth is outpacing revenue growth.',
      recommendations: [
        'Tighten credit terms',
        'Prioritize collections for top debtors'
      ]
    });
  }

  if (debtorsSummary?.concentrationRatio && debtorsSummary.concentrationRatio > 0.5) {
    insights.push({
      type: 'DEBTORS',
      riskLevel: 'AMBER',
      title: 'Receivables Concentration Risk',
      content: 'A large share of receivables is concentrated in top customers.',
      explanation: 'High concentration can increase cashflow volatility.',
      recommendations: [
        'Diversify customer base',
        'Monitor top debtor exposure weekly'
      ]
    });
  }

  const creditorsSummary = await creditorsService.getSummary(companyId);
  if (creditorsSummary?.cashPressure) {
    insights.push({
      type: 'CREDITORS',
      riskLevel: 'AMBER',
      title: 'Creditors Pressure',
      content: 'Creditors outstanding exceed current cash balance.',
      explanation: 'Payables may create near-term cash pressure.',
      recommendations: [
        'Review payment schedules',
        'Forecast cash commitments for the next 30 days'
      ]
    });
  }

  // Save insights to database
  for (const insight of insights) {
    await AIInsight.findOrCreate({
      where: {
        companyId,
        type: insight.type,
        riskLevel: insight.riskLevel,
        title: insight.title,
        created_at: {
          [Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      defaults: {
        companyId,
        ...insight,
        dataPoints: {
          runway: overview.runway,
          revenue: revenueData.summary,
          expenses: expenseData.summary
        }
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
  const overview = await dashboardService.getCFOOverview(companyId);
  const revenue = await dashboardService.getRevenueDashboard(companyId, '3m');
  const expenses = await dashboardService.getExpenseDashboard(companyId, '3m');
  const debtors = await debtorsService.getSummary(companyId);
  const creditors = await creditorsService.getSummary(companyId);

  const safeByCategory = Array.isArray(expenses.byCategory) ? expenses.byCategory : [];
  const context = {
    cashBalance: overview.cashPosition.currentBalance,
    runway: overview.runway,
    revenue: revenue.summary,
    expenses: expenses.summary,
    expenseCategories: safeByCategory,
    debtors,
    creditors
  };

  // Simple response logic (in production, this would call OpenAI API)
  const responses = {
    'runway': `Based on your current cash position of ₹${context.cashBalance.toLocaleString()} ` +
      `and average net cash flow of ₹${context.runway.netCashFlow.toLocaleString()} per month, ` +
      `your runway is approximately ${context.runway.months} months. Status: ${context.runway.status}.`,
    'revenue': `Your total revenue for the last 3 months is ₹${context.revenue.totalRevenue.toLocaleString()} ` +
      `with a growth rate of ${context.revenue.growthRate.toFixed(1)}%.`,
    'expenses': `Your total expenses for the latest closed month are ₹${context.expenses.totalExpenses.toLocaleString()}. ` +
      `Top categories: ${context.expenseCategories.slice(0, 3).map(c => c.category).join(', ') || 'Not enough data'}.`,
    'cash': `Your current cash balance is ₹${context.cashBalance.toLocaleString()}. ` +
      `Runway: ${context.runway.months} months (${context.runway.status}).`,
    'default': `I can help you with information about your cash position, runway, revenue, and expenses. ` +
      `What would you like to know?`
  };

  const lowerMessage = message.toLowerCase();
  let response = responses.default;

  if (lowerMessage.includes('runway')) {
    response = responses.runway;
  } else if (lowerMessage.includes('revenue') || lowerMessage.includes('sales')) {
    response = responses.revenue;
  } else if (lowerMessage.includes('expense') || lowerMessage.includes('cost')) {
    response = responses.expenses;
  } else if (lowerMessage.includes('cash') || lowerMessage.includes('balance')) {
    response = responses.cash;
  }

  return {
    message: response,
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
