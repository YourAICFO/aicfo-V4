const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinancialTransaction = sequelize.define('FinancialTransaction', {
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('REVENUE', 'EXPENSE', 'OPENING_BALANCE'),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  subcategory: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source: {
    type: DataTypes.ENUM('MANUAL', 'TALLY', 'ZOHO', 'QUICKBOOKS'),
    defaultValue: 'MANUAL'
  },
  externalId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'external_id'
  },
  reference: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_recurring'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'financial_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['date'] },
    { fields: ['type'] },
    { fields: ['category'] },
    { fields: ['source'] }
  ]
});

module.exports = { FinancialTransaction };
