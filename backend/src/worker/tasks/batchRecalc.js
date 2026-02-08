const { Sequelize } = require('sequelize');
const { FinancialTransaction, sequelize } = require('../../models');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const batchRecalc = async ({ companyId, periodStart, periodEnd }) => {
  await assertTrialOrActive(companyId);
  return sequelize.transaction(async (t) => {
    const totals = await FinancialTransaction.findAll({
      where: {
        companyId,
        date: {
          [Sequelize.Op.gte]: periodStart,
          [Sequelize.Op.lte]: periodEnd
        }
      },
      attributes: [
        'type',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      group: ['type'],
      raw: true,
      transaction: t
    });

    return totals.map(row => ({
      type: row.type,
      total: parseFloat(row.total)
    }));
  });
};

module.exports = { batchRecalc };
