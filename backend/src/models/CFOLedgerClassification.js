const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOLedgerClassification = sequelize.define('CFOLedgerClassification', {
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
  ledgerName: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'ledger_name'
  },
  ledgerGuid: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'ledger_guid'
  },
  parentGroup: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'parent_group'
  },
  cfoCategory: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cfo_category'
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'last_seen_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'cfo_ledger_classifications',
  timestamps: false
});

module.exports = { CFOLedgerClassification };
