const { sequelize } = require('../models');

const markCompanyActiveToday = async (companyId) => {
  if (!companyId) return;
  const day = new Date().toISOString().slice(0, 10);
  await sequelize.query(
    `INSERT INTO usage_daily (company_id, day, is_active, created_at)
     VALUES (:companyId, :day, TRUE, NOW())
     ON CONFLICT (company_id, day) DO NOTHING`,
    {
      replacements: { companyId, day }
    }
  ).catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('usage_daily mark failed:', error.message);
    }
  });
};

module.exports = { markCompanyActiveToday };
