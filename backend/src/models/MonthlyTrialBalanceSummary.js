const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyTrialBalanceSummary = sequelize.define('MonthlyTrialBalanceSummary', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'companies',
      key: 'id'
    }
  },
  month: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  cashAndBankBalance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'cash_and_bank_balance'
  },
  totalAssets: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_assets'
  },
  totalLiabilities: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_liabilities'
  },
  totalEquity: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_equity'
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_revenue'
  },
  totalExpenses: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_expenses'
  },
  netProfit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'net_profit'
  },
  netCashflow: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'net_cashflow'
  }
}, {
  tableName: 'monthly_trial_balance_summary',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['month'] },
    { unique: true, fields: ['company_id', 'month'] }
  ]
});

module.exports = { MonthlyTrialBalanceSummary };
