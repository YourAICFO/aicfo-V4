const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CashBalance = sequelize.define('CashBalance', {
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
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  source: {
    type: DataTypes.ENUM('MANUAL', 'TALLY', 'ZOHO', 'QUICKBOOKS', 'CALCULATED'),
    defaultValue: 'MANUAL'
  },
  bankName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'bank_name'
  },
  accountNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'account_number'
  },
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_primary'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'cash_balances',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['date'] }
  ]
});

module.exports = { CashBalance };
