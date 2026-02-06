const { Sequelize } = require('sequelize');
const { FinancialTransaction, FinancialReport, sequelize } = require('../../models');

const buildReportData = async (companyId, periodStart, periodEnd, type) => {
  const baseWhere = {
    companyId,
    date: {
      [Sequelize.Op.gte]: periodStart,
      [Sequelize.Op.lte]: periodEnd
    }
  };

  if (type === 'P_AND_L') {
    const revenue = await FinancialTransaction.findOne({
      where: { ...baseWhere, type: 'REVENUE' },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
    const expenses = await FinancialTransaction.findOne({
      where: { ...baseWhere, type: 'EXPENSE' },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
    const totalRevenue = parseFloat(revenue?.total || 0);
    const totalExpenses = parseFloat(expenses?.total || 0);
    return {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses
    };
  }

  if (type === 'CASH_FLOW') {
    const inflow = await FinancialTransaction.findOne({
      where: { ...baseWhere, type: 'REVENUE' },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
    const outflow = await FinancialTransaction.findOne({
      where: { ...baseWhere, type: 'EXPENSE' },
      attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
      raw: true
    });
    const totalInflow = parseFloat(inflow?.total || 0);
    const totalOutflow = parseFloat(outflow?.total || 0);
    return {
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow
    };
  }

  return {
    assets: 0,
    liabilities: 0,
    equity: 0
  };
};

const updateReports = async ({ companyId, periodStart, periodEnd }) => {
  const types = ['P_AND_L', 'CASH_FLOW', 'BALANCE_SHEET'];

  return sequelize.transaction(async (t) => {
    const results = [];
    for (const type of types) {
      const data = await buildReportData(companyId, periodStart, periodEnd, type);
      const [report] = await FinancialReport.upsert({
        companyId,
        type,
        periodStart,
        periodEnd,
        data
      }, { transaction: t, returning: true });
      results.push(report);
    }
    return results;
  });
};

module.exports = { updateReports };
