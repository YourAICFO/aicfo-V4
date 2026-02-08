const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CurrentCashBalance = sequelize.define('CurrentCashBalance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: { model: 'companies', key: 'id' }
  },
  accountName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'account_name'
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'current_cash_balances',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { unique: true, fields: ['company_id', 'account_name'] }
  ]
});

module.exports = { CurrentCashBalance };
