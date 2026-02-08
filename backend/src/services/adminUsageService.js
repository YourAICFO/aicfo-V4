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

const logAIQuestion = async (companyId, userId, question, success = true) => {
  await AdminAIQuestion.create({
    companyId,
    userId,
    question,
    success
  });
};

const getUsageSummary = async () => {
  const companiesCount = await Company.count();
  const activeUsers = await sequelize.query(
    `SELECT COUNT(DISTINCT user_id) AS count
     FROM admin_usage_events
     WHERE created_at >= NOW() - INTERVAL '30 days'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const loginCounts = await sequelize.query(
    `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count
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

  return {
    companiesCount,
    activeUsers: Number(activeUsers?.[0]?.count || 0),
    loginCounts,
    dashboardOpens: Number(dashboardOpens?.[0]?.count || 0),
    aiQuestions,
    aiFailures
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
            MAX(e.created_at) AS last_seen
     FROM companies c
     LEFT JOIN admin_usage_events e ON e.company_id = c.id
     GROUP BY c.id, c.name
     ORDER BY last_seen DESC NULLS LAST`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  return rows;
};

module.exports = {
  logEvent,
  logAIQuestion,
  getUsageSummary,
  getAIQuestions,
  getCompaniesActivity
};
