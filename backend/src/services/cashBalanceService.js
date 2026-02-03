const { CashBalance } = require('../models');

const createCashBalance = async (companyId, balanceData) => {
  const balance = await CashBalance.create({
    companyId,
    ...balanceData,
    source: 'MANUAL'
  });

  return balance;
};

const getCashBalances = async (companyId, options = {}) => {
  const { limit = 50, offset = 0 } = options;

  const { count, rows } = await CashBalance.findAndCountAll({
    where: { companyId },
    order: [['date', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return {
    balances: rows,
    pagination: {
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      pages: Math.ceil(count / limit)
    }
  };
};

const getLatestBalance = async (companyId) => {
  const balance = await CashBalance.findOne({
    where: { companyId },
    order: [['date', 'DESC']]
  });

  return balance;
};

const updateCashBalance = async (balanceId, companyId, updateData) => {
  const balance = await CashBalance.findOne({
    where: { id: balanceId, companyId }
  });

  if (!balance) {
    throw new Error('Cash balance not found');
  }

  const allowedUpdates = ['date', 'amount', 'bankName', 'accountNumber', 'isPrimary', 'notes'];
  const updates = {};

  allowedUpdates.forEach(field => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  await balance.update(updates);
  return balance;
};

const deleteCashBalance = async (balanceId, companyId) => {
  const balance = await CashBalance.findOne({
    where: { id: balanceId, companyId }
  });

  if (!balance) {
    throw new Error('Cash balance not found');
  }

  await balance.destroy();
  return { message: 'Cash balance deleted successfully' };
};

module.exports = {
  createCashBalance,
  getCashBalances,
  getLatestBalance,
  updateCashBalance,
  deleteCashBalance
};
