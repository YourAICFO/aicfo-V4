const { AiUsageDaily, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Record usage for a feature (increment count for today).
 * @param {string} companyId
 * @param {string} featureKey - e.g. 'ai_pl_explanation', 'ai_chat_message', 'report_download'
 * @param {number} inc - increment (default 1)
 */
async function recordUsage(companyId, featureKey, inc = 1) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [row] = await AiUsageDaily.findOrCreate({
    where: { companyId, date: today, featureKey },
    defaults: { companyId, date: today, featureKey, count: 0 },
  });
  await row.increment('count', { by: inc });
  await row.reload();
  return row;
}

/**
 * Get total usage for a feature in the given month.
 * @param {string} companyId
 * @param {string} featureKey
 * @param {string} currentMonth - 'YYYY-MM'
 * @returns {Promise<number>}
 */
async function getUsage(companyId, featureKey, currentMonth) {
  const start = `${currentMonth}-01`;
  const [endYear, endMonth] = currentMonth.split('-').map(Number);
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const end = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

  const result = await AiUsageDaily.sum('count', {
    where: {
      companyId,
      featureKey,
      date: {
        [Op.between]: [start, end],
      },
    },
  });
  return Number(result) || 0;
}

module.exports = {
  recordUsage,
  getUsage,
};
