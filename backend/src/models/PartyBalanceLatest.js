const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PartyBalanceLatest = sequelize.define('PartyBalanceLatest', {
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
  asOfDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'as_of_date'
  },
  partyType: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'party_type'
  },
  partyName: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'party_name'
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  source: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'snapshot'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'createdAt',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updatedAt',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'party_balances_latest',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

module.exports = { PartyBalanceLatest };
