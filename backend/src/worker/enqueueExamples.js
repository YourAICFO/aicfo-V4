const { enqueueJob } = require('./queue');

const enqueueDailyInsights = async (companyId, userId) => {
  return enqueueJob('generateAIInsights', {
    companyId,
    userId
  }, {
    delay: 24 * 60 * 60 * 1000
  });
};

const enqueueReports = async (companyId, userId, periodStart, periodEnd) => {
  return enqueueJob('updateReports', {
    companyId,
    userId,
    periodStart,
    periodEnd
  });
};

module.exports = { enqueueDailyInsights, enqueueReports };
