const OpenAI = require('openai');
const { Sequelize } = require('sequelize');
const { AIInsight } = require('../../models');
const dashboardService = require('../../services/dashboardService');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const buildPrompt = (context) => {
  return `
You are a CFO assistant. Use only the data provided.
Return JSON with fields: type, riskLevel, title, content, explanation, recommendations (array).

Context:
${JSON.stringify(context, null, 2)}
`;
};

const generateAIInsights = async ({ companyId }) => {
  await assertTrialOrActive(companyId);
  const overview = await dashboardService.getCFOOverview(companyId);
  const revenue = await dashboardService.getRevenueDashboard(companyId, '3m');
  const expenses = await dashboardService.getExpenseDashboard(companyId, '3m');

  const context = {
    cash: overview.cashPosition,
    runway: overview.runway,
    revenue: revenue.summary,
    expenses: expenses.summary
  };

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a conservative CFO.' },
      { role: 'user', content: buildPrompt(context) }
    ],
    response_format: { type: 'json_object' }
  });

  const content = response.choices?.[0]?.message?.content || '{}';
  let insight;
  try {
    insight = JSON.parse(content);
  } catch {
    insight = null;
  }

  if (!insight || !insight.title) {
    return { stored: 0 };
  }

  const [record] = await AIInsight.findOrCreate({
    where: {
      companyId,
      type: insight.type || 'RECOMMENDATION',
      riskLevel: insight.riskLevel || 'AMBER',
      title: insight.title,
      created_at: {
        [Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    },
    defaults: {
      companyId,
      type: insight.type || 'RECOMMENDATION',
      riskLevel: insight.riskLevel || 'AMBER',
      title: insight.title,
      content: insight.content || '',
      explanation: insight.explanation || '',
      recommendations: insight.recommendations || [],
      dataPoints: context
    }
  });

  return { stored: record ? 1 : 0 };
};

module.exports = { generateAIInsights };
