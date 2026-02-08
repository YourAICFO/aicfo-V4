const { Sequelize } = require('sequelize');
const { AIInsight } = require('../models');
const dashboardService = require('./dashboardService');

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

  // Revenue trend analysis
  const revenueData = await dashboardService.getRevenueDashboard(companyId, '3m');
  if (revenueData.summary.growthRate < -10) {
    insights.push({
      type: 'REVENUE',
      riskLevel: 'RED',
      title: 'Revenue Declining',
      content: `Revenue has declined by ${Math.abs(revenueData.summary.growthRate).toFixed(1)}% compared to previous period.`,
      explanation: 'Comparing current 3-month period to previous 3-month period.',
      recommendations: [
        'Analyze customer churn reasons',
        'Review pricing strategy',
        'Explore new revenue channels'
      ]
    });
  } else if (revenueData.summary.growthRate > 20) {
    insights.push({
      type: 'REVENUE',
      riskLevel: 'GREEN',
      title: 'Strong Revenue Growth',
      content: `Revenue has grown by ${revenueData.summary.growthRate.toFixed(1)}% compared to previous period.`,
      explanation: 'Comparing current 3-month period to previous 3-month period.',
      recommendations: [
        'Invest in scaling operations',
        'Consider expanding team',
        'Maintain growth momentum'
      ]
    });
  }

  // Expense analysis
  const expenseData = await dashboardService.getExpenseDashboard(companyId, '3m');
  const revenueTotal = revenueData.summary.totalRevenue;
  const expenseTotal = expenseData.summary.totalExpenses;

  if (revenueTotal > 0) {
    const expenseRatio = (expenseTotal / revenueTotal) * 100;
    if (expenseRatio > 90) {
      insights.push({
        type: 'EXPENSE',
        riskLevel: 'RED',
        title: 'High Expense Ratio',
        content: `Expenses are ${expenseRatio.toFixed(1)}% of revenue. Margins are critically low.`,
        explanation: `Total expenses: ₹${expenseTotal.toLocaleString()}. Total revenue: ₹${revenueTotal.toLocaleString()}.`,
        recommendations: [
          'Conduct immediate expense audit',
          'Identify and eliminate non-essential costs',
          'Renegotiate vendor contracts',
          'Consider operational restructuring'
        ]
      });
    } else if (expenseRatio > 80) {
      insights.push({
        type: 'EXPENSE',
        riskLevel: 'AMBER',
        title: 'Elevated Expense Ratio',
        content: `Expenses are ${expenseRatio.toFixed(1)}% of revenue.`,
        explanation: `Total expenses: ₹${expenseTotal.toLocaleString()}. Total revenue: ₹${revenueTotal.toLocaleString()}.`,
        recommendations: [
          'Review major expense categories',
          'Implement cost control measures',
          'Track expenses weekly'
        ]
      });
    }
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

  const safeByCategory = Array.isArray(expenses.byCategory) ? expenses.byCategory : [];
  const context = {
    cashBalance: overview.cashPosition.currentBalance,
    runway: overview.runway,
    revenue: revenue.summary,
    expenses: expenses.summary,
    expenseCategories: safeByCategory
  };

  // Simple response logic (in production, this would call OpenAI API)
  const responses = {
    'runway': `Based on your current cash position of ₹${context.cashBalance.toLocaleString()} ` +
      `and average net cash flow of ₹${context.runway.netCashFlow.toLocaleString()} per month, ` +
      `your runway is approximately ${context.runway.months} months. Status: ${context.runway.status}.`,
    'revenue': `Your total revenue for the last 3 months is ₹${context.revenue.totalRevenue.toLocaleString()} ` +
      `with a growth rate of ${context.revenue.growthRate.toFixed(1)}%.`,
    'expenses': `Your total expenses for the last 3 months are ₹${context.expenses.totalExpenses.toLocaleString()}. ` +
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
