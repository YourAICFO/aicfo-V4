const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyCreditor = sequelize.define('MonthlyCreditor', {
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
  creditorName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'creditor_name'
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
  closingBalance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'closing_balance'
  },
  totalCreditorsBalance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_creditors_balance'
  },
  percentageOfTotal: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: false,
    defaultValue: 0,
    field: 'percentage_of_total'
  },
  momChange: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 0,
    field: 'mom_change'
  },
  avg3m: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'avg_3m'
  },
  avg6m: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'avg_6m'
  },
  avg12m: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'avg_12m'
  },
  trendFlag: {
    type: DataTypes.STRING(8),
    allowNull: false,
    defaultValue: 'STABLE',
    field: 'trend_flag'
  },
  concentrationFlag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'concentration_flag'
  }
}, {
  tableName: 'monthly_creditors',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['month'] },
    { unique: true, fields: ['company_id', 'month', 'creditor_name'] }
  ]
});

module.exports = { MonthlyCreditor };
