const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyExpenseBreakdown = sequelize.define('MonthlyExpenseBreakdown', {
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
  expenseName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'expense_name'
  },
  normalizedExpenseCategory: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'normalized_expense_category'
  },
  rawHeadName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'raw_head_name'
  },
  canonicalType: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'canonical_type'
  },
  canonicalSubtype: {
    type: DataTypes.STRING(128),
    allowNull: true,
    field: 'canonical_subtype'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'monthly_expense_breakdown',
  timestamps: false
});

module.exports = { MonthlyExpenseBreakdown };
