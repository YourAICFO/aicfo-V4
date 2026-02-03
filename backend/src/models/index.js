const { sequelize } = require('../config/database');
const { User } = require('./User');
const { Company } = require('./Company');
const { Subscription } = require('./Subscription');
const { FinancialTransaction } = require('./FinancialTransaction');
const { CashBalance } = require('./CashBalance');
const { Integration } = require('./Integration');
const { AIInsight } = require('./AIInsight');

// User - Company (One-to-Many)
User.hasMany(Company, { foreignKey: 'owner_id', as: 'companies' });
Company.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// Company - Subscription (One-to-One)
Company.hasOne(Subscription, { foreignKey: 'company_id', as: 'subscription' });
Subscription.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - FinancialTransaction (One-to-Many)
Company.hasMany(FinancialTransaction, { foreignKey: 'company_id', as: 'transactions' });
FinancialTransaction.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - CashBalance (One-to-Many)
Company.hasMany(CashBalance, { foreignKey: 'company_id', as: 'cashBalances' });
CashBalance.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - Integration (One-to-Many)
Company.hasMany(Integration, { foreignKey: 'company_id', as: 'integrations' });
Integration.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - AIInsight (One-to-Many)
Company.hasMany(AIInsight, { foreignKey: 'company_id', as: 'insights' });
AIInsight.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

module.exports = {
  sequelize,
  User,
  Company,
  Subscription,
  FinancialTransaction,
  CashBalance,
  Integration,
  AIInsight
};
