const { Sequelize } = require('sequelize');
const { FinancialTransaction, Subscription, CashBalance } = require('../models');
const { assertTrialOrActive } = require('./subscriptionService');

const createTransaction = async (companyId, transactionData) => {
  await assertTrialOrActive(companyId);
  // Check subscription limits
  const subscription = await Subscription.findOne({ where: { companyId } });

  if (subscription && subscription.planType === 'FREE') {
    const transactionCount = await FinancialTransaction.count({ where: { companyId } });
    if (transactionCount >= subscription.maxTransactions) {
      throw new Error('Transaction limit reached for FREE plan. Upgrade to add more transactions.');
    }
  }

  const payload = {
    companyId,
    ...transactionData,
    source: 'MANUAL'
  };

  if (payload.type === 'OPENING_BALANCE' && !payload.category) {
    payload.category = 'Opening Balance';
  }

  const transaction = await FinancialTransaction.create(payload);

  if (transaction.type === 'OPENING_BALANCE') {
    await CashBalance.create({
      companyId,
      date: transaction.date,
      amount: transaction.amount,
      source: 'CALCULATED',
      notes: 'Opening balance from manual transaction'
    });
  }

  return transaction;
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
  const transaction = await FinancialTransaction.findOne({
    where: { id: transactionId, companyId }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Only allow updating manual transactions
  if (transaction.source !== 'MANUAL') {
    throw new Error('Cannot update transactions from integrated sources');
  }

  const allowedUpdates = ['date', 'type', 'category', 'subcategory', 'amount', 'description', 'reference', 'tags'];
  const updates = {};

  allowedUpdates.forEach(field => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  await transaction.update(updates);
  return transaction;
};

const deleteTransaction = async (transactionId, companyId) => {
  await assertTrialOrActive(companyId);
  const transaction = await FinancialTransaction.findOne({
    where: { id: transactionId, companyId }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Only allow deleting manual transactions
  if (transaction.source !== 'MANUAL') {
    throw new Error('Cannot delete transactions from integrated sources');
  }

  await transaction.destroy();
  return { message: 'Transaction deleted successfully' };
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
