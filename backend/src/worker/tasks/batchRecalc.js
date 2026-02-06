const { Sequelize } = require('sequelize');
const { FinancialTransaction, sequelize } = require('../../models');

const batchRecalc = async ({ companyId, periodStart, periodEnd }) => {
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
