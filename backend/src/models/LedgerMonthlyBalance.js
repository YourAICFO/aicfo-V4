const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LedgerMonthlyBalance = sequelize.define('LedgerMonthlyBalance', {
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
  monthKey: {
    type: DataTypes.STRING(7),
    allowNull: false,
    field: 'month_key'
  },
  ledgerGuid: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'ledger_guid'
  },
  ledgerName: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'ledger_name'
  },
  parentGroup: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'parent_group'
  },
  cfoCategory: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'cfo_category'
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  asOfDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'as_of_date'
  }
}, {
  tableName: 'ledger_monthly_balances',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

module.exports = { LedgerMonthlyBalance };
