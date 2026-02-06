const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinancialReport = sequelize.define('FinancialReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id'
  },
  type: {
    type: DataTypes.ENUM('P_AND_L', 'CASH_FLOW', 'BALANCE_SHEET'),
    allowNull: false
  },
  periodStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_start'
  },
  periodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_end'
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'financial_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['type'] },
    { fields: ['period_start', 'period_end'] },
    { unique: true, fields: ['company_id', 'type', 'period_start', 'period_end'] }
  ]
});

module.exports = { FinancialReport };
