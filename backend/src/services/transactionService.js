const { Sequelize } = require('sequelize');
const { FinancialTransaction } = require('../models');
const { assertTrialOrActive } = require('./subscriptionService');

const createTransaction = async (companyId, transactionData) => {
  await assertTrialOrActive(companyId);
  throw new Error('Manual transaction entry is disabled. Connect your accounting software to sync data.');
};

const getTransactions = async (companyId, options = {}) => {
  const { type, category, startDate, endDate, limit = 50, offset = 0 } = options;

  const where = { companyId };

  if (type) where.type = type;
  if (category) where.category = category;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date[Sequelize.Op.gte] = startDate;
    if (endDate) where.date[Sequelize.Op.lte] = endDate;
  }

  const { count, rows } = await FinancialTransaction.findAndCountAll({
    where,
    order: [['date', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return {
    transactions: rows,
    pagination: {
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      pages: Math.ceil(count / limit)
    }
  };
};

const getTransactionById = async (transactionId, companyId) => {
  const transaction = await FinancialTransaction.findOne({
    where: { id: transactionId, companyId }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return transaction;
};

const updateTransaction = async (transactionId, companyId, updateData) => {
  await assertTrialOrActive(companyId);
  throw new Error('Manual transaction entry is disabled.');
};

const deleteTransaction = async (transactionId, companyId) => {
  await assertTrialOrActive(companyId);
  throw new Error('Manual transaction entry is disabled.');
};

const getCategories = async (companyId) => {
  const categories = await FinancialTransaction.findAll({
    where: { companyId },
    attributes: [
      'type',
      'category',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
    ],
    group: ['type', 'category'],
    raw: true
  });

  const revenueCategories = categories
    .filter(c => c.type === 'REVENUE')
    .map(c => ({ category: c.category, count: parseInt(c.count), total: parseFloat(c.total) }));

  const expenseCategories = categories
    .filter(c => c.type === 'EXPENSE')
    .map(c => ({ category: c.category, count: parseInt(c.count), total: parseFloat(c.total) }));

  return {
    revenue: revenueCategories,
    expense: expenseCategories
  };
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getCategories
};
