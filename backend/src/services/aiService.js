const { AIInsight } = require('../models');
const dashboardService = require('./dashboardService');
const cfoQuestionService = require('./cfoQuestionService');
const cfoContextService = require('./cfoContextService');
const { buildInsights } = require('../insights/buildInsights');
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

const generateInsights = async (companyId, userId = null) => {
  return buildInsights(companyId, userId, { limit: 10 });
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
  await generateInsights(companyId, userId);

  const insights = await AIInsight.findAll({
    where: {
      companyId,
      isDismissed: false
    },
    order: [['generated_at', 'DESC']]
  });

  const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
  const filtered = insights
    .map((insight) => {
      const severity = String(insight?.dataPoints?.severity || '').toLowerCase();
      const priorityRank = Number(insight?.dataPoints?.priority_rank || 999);
      return { insight, severity, priorityRank };
    })
    .filter((item) => ['critical', 'high'].includes(item.severity))
    .sort((a, b) => {
      const sevDelta = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (sevDelta !== 0) return sevDelta;
      return a.priorityRank - b.priorityRank;
    })
    .slice(0, 10)
    .map((item) => item.insight);

  return filtered;
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

/** Build CFO-style narrative for P&L Pack using only provided deterministic data. AI must not invent numbers. */
const generatePlPackNarrative = async (structuredData) => {
  if (!process.env.OPENAI_API_KEY || !OpenAI) {
    return 'AI explanation is not configured. Enable OPENAI_API_KEY.';
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are a CFO writing a short narrative for a P&L review pack. Use ONLY the numbers provided below. Do not invent or compute any numbers.

Write:
- 5–8 bullet points (or 1 short paragraph plus bullets)
- Mention: Revenue, Gross Profit/Margin, Opex, and Net Profit — use MoM deltas and variance % (variances.revenue, variances.revenuePct, etc.) when present
- Mention YTD vs last FY where provided: use ytd, ytdLastFy, ytdVarianceAmount, ytdVariancePct (same period prior financial year)
- Cite the top 2–3 drivers per category from the "drivers" object where provided
- End with exactly 3 "Suggested actions" (guidance only, no new numbers)
- If a percentage is null or missing, do not invent one; say "vs prior period" or similar without a number

Structured data (use only these values):
${JSON.stringify(structuredData, null, 2)}

Output plain text only. No JSON.`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You write concise CFO narratives. You never invent numbers; you only use the provided data.' },
      { role: 'user', content: prompt }
    ]
  });
  const content = response?.choices?.[0]?.message?.content?.trim();
  return content || 'Unable to generate narrative.';
};

module.exports = {
  generateInsights,
  getInsights,
  markInsightRead,
  dismissInsight,
  chatWithCFO,
  generatePlPackNarrative,
  SYSTEM_PROMPT
};
