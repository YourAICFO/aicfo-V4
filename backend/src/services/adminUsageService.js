const { Sequelize } = require('sequelize');
const { AdminUsageEvent, AdminAIQuestion, Company, User, sequelize } = require('../models');

const logEvent = async (companyId, userId, eventType, metadata = {}) => {
  await AdminUsageEvent.create({
    companyId,
    userId,
    eventType,
    metadata
  });
};

const logUsageEvent = async ({ companyId, userId, eventType, eventName, metadata }) => {
  try {
    await AdminUsageEvent.create({
      companyId,
      userId,
      eventType,
      metadata: {
        eventName: eventName || null,
        ...(metadata || {})
      }
    });
  } catch (error) {
    console.warn('Usage log failed:', error.message);
  }
};

const logAIQuestion = async (companyId, userId, question, success = true, details = {}) => {
  try {
    await AdminAIQuestion.create({
      companyId,
      userId,
      question,
      success,
      detectedQuestionKey: details.detectedQuestionKey || null,
      failureReason: details.failureReason || null,
      reason: details.reason || null,
      missingMetricKeys: details.missingMetricKeys || [],
      metricsUsedJson: details.metricsUsedJson || {},
      requestedAt: details.requestedAt || new Date()
    });
  } catch (error) {
    console.warn('AI question log failed:', error.message);
  }
};

const getUsageSummary = async () => {
  const companiesCount = await Company.count();
  const activeUsers = await sequelize.query(
    `SELECT COUNT(DISTINCT user_id) AS count
     FROM admin_usage_events
     WHERE "createdAt" >= NOW() - INTERVAL '30 days'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const dau = await sequelize.query(
    `SELECT COUNT(DISTINCT user_id) AS count
     FROM admin_usage_events
     WHERE "createdAt" >= NOW() - INTERVAL '1 day'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const mau = await sequelize.query(
    `SELECT COUNT(DISTINCT user_id) AS count
     FROM admin_usage_events
     WHERE "createdAt" >= NOW() - INTERVAL '30 days'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const loginCounts = await sequelize.query(
    `SELECT DATE_TRUNC('month', "createdAt") AS month, COUNT(*) AS count
     FROM admin_usage_events
     WHERE event_type = 'login'
     GROUP BY month
     ORDER BY month`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const dashboardOpens = await sequelize.query(
    `SELECT COUNT(*) AS count
     FROM admin_usage_events
     WHERE event_type = 'dashboard_open'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const aiQuestions = await AdminAIQuestion.count();
  const aiFailures = await AdminAIQuestion.count({ where: { success: false } });
  const alertsCount = await sequelize.query(
    `SELECT COUNT(*) AS count FROM cfo_alerts`,
    { type: Sequelize.QueryTypes.SELECT }
  );

  return {
    companiesCount,
    activeUsers: Number(activeUsers?.[0]?.count || 0),
    dau: Number(dau?.[0]?.count || 0),
    mau: Number(mau?.[0]?.count || 0),
    loginCounts,
    dashboardOpens: Number(dashboardOpens?.[0]?.count || 0),
    aiQuestions,
    aiFailures,
    alertsGenerated: Number(alertsCount?.[0]?.count || 0)
  };
};

const getAIQuestions = async () => {
  const topQuestions = await sequelize.query(
    `SELECT question, COUNT(*) AS count
     FROM admin_ai_questions
     GROUP BY question
     ORDER BY count DESC
     LIMIT 20`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  return { topQuestions };
};

const getCompaniesActivity = async () => {
  const rows = await sequelize.query(
    `SELECT c.id, c.name,
            COUNT(e.id) AS events,
            MAX(e."createdAt") AS last_seen
     FROM companies c
     LEFT JOIN admin_usage_events e ON e.company_id = c.id
     GROUP BY c.id, c.name
     ORDER BY last_seen DESC NULLS LAST`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  return rows;
};

const getMetricsSummary = async () => {
  const companiesTotal = await Company.count();
  const companiesActive = await sequelize.query(
    `SELECT COUNT(DISTINCT company_id) AS count
     FROM admin_usage_events
     WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND company_id IS NOT NULL`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const usersTotal = await User.count();

  const usageCounts = await sequelize.query(
    `SELECT event_type, COUNT(*) AS count
     FROM admin_usage_events
     WHERE "createdAt" >= NOW() - INTERVAL '30 days'
     GROUP BY event_type`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const usageMap = usageCounts.reduce((acc, row) => {
    acc[row.event_type] = Number(row.count || 0);
    return acc;
  }, {});

  const aiTotals = await sequelize.query(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS failure
     FROM admin_ai_questions
     WHERE "createdAt" >= NOW() - INTERVAL '30 days'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const total = Number(aiTotals?.[0]?.total || 0);
  const success = Number(aiTotals?.[0]?.success || 0);
  const failure = Number(aiTotals?.[0]?.failure || 0);
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;

  return {
    companies_total: companiesTotal,
    companies_active_30d: Number(companiesActive?.[0]?.count || 0),
    users_total: usersTotal,
    usage_last_30d: {
      dashboard_opens: usageMap.dashboard_open || 0,
      ai_chats: usageMap.ai_chat || 0,
      ai_insights: usageMap.ai_insight || 0,
      cfo_questions: usageMap.cfo_question || 0
    },
    ai_last_30d: {
      total,
      success,
      failure,
      success_rate: successRate
    }
  };
};

const getUsageByMonth = async (months = 12) => {
  const rows = await sequelize.query(
    `SELECT DATE_TRUNC('month', "createdAt") AS month, event_type, COUNT(*) AS count
     FROM admin_usage_events
     WHERE "createdAt" >= NOW() - INTERVAL '${months} months'
     GROUP BY month, event_type
     ORDER BY month`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const byEventType = {};
  const monthsSet = new Set();
  rows.forEach((row) => {
    const monthKey = row.month.toISOString().slice(0, 7);
    monthsSet.add(monthKey);
    if (!byEventType[row.event_type]) byEventType[row.event_type] = [];
    byEventType[row.event_type].push({ month: monthKey, count: Number(row.count || 0) });
  });
  return {
    months: Array.from(monthsSet).sort(),
    byEventType
  };
};

const getAIAnalytics = async (months = 12) => {
  const topQuestions = await sequelize.query(
    `SELECT COALESCE(detected_question_key, question) AS key, COUNT(*) AS count
     FROM admin_ai_questions
     WHERE "createdAt" >= NOW() - INTERVAL '${months} months'
     GROUP BY key
     ORDER BY count DESC
     LIMIT 20`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const failedQuestions = await sequelize.query(
    `SELECT COALESCE(detected_question_key, question) AS key, COUNT(*) AS count
     FROM admin_ai_questions
     WHERE success = false AND "createdAt" >= NOW() - INTERVAL '${months} months'
     GROUP BY key
     ORDER BY count DESC
     LIMIT 20`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const failureReasons = await sequelize.query(
    `SELECT failure_reason, COUNT(*) AS count
     FROM admin_ai_questions
     WHERE success = false AND "createdAt" >= NOW() - INTERVAL '${months} months'
     GROUP BY failure_reason
     ORDER BY count DESC
     LIMIT 10`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const totals = await sequelize.query(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS failure
     FROM admin_ai_questions
     WHERE "createdAt" >= NOW() - INTERVAL '${months} months'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const total = Number(totals?.[0]?.total || 0);
  const success = Number(totals?.[0]?.success || 0);
  const failure = Number(totals?.[0]?.failure || 0);
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;
  return {
    topQuestions,
    failedQuestions,
    failureReasons,
    totals: { total, success, failure, successRate }
  };
};

const getCustomerMetrics = async () => {
  const rows = await sequelize.query(
    `SELECT c.id AS company_id, c.name AS company_name,
            MAX(e."createdAt") AS last_seen_at,
            SUM(CASE WHEN e.event_type = 'dashboard_open' AND e."createdAt" >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS dashboard_opens_30d,
            SUM(CASE WHEN e.event_type = 'ai_chat' AND e."createdAt" >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS ai_chats_30d,
            SUM(CASE WHEN e.event_type = 'ai_insight' AND e."createdAt" >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS ai_insights_30d,
            SUM(CASE WHEN e.event_type = 'cfo_question' AND e."createdAt" >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS cfo_questions_30d,
            SUM(CASE WHEN q.success = false AND q."createdAt" >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS ai_failures_30d
     FROM companies c
     LEFT JOIN admin_usage_events e ON e.company_id = c.id
     LEFT JOIN admin_ai_questions q ON q.company_id = c.id
     GROUP BY c.id, c.name
     ORDER BY last_seen_at DESC NULLS LAST`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  return rows;
};

module.exports = {
  logEvent,
  logUsageEvent,
  logAIQuestion,
  getUsageSummary,
  getAIQuestions,
  getCompaniesActivity,
  getMetricsSummary,
  getUsageByMonth,
  getAIAnalytics,
  getCustomerMetrics
};
