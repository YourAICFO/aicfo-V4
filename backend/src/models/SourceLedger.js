const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SourceLedger = sequelize.define('SourceLedger', {
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
  sourceSystem: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'source_system'
  },
  sourceLedgerId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'source_ledger_id'
  },
  sourceLedgerName: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'source_ledger_name'
  },
  sourceGroupName: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'source_group_name'
  },
  sourceParentGroup: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'source_parent_group'
  },
  sourceGroupPath: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'source_group_path'
  },
  rawPayload: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'raw_payload'
  }
}, {
  tableName: 'source_ledgers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = { SourceLedger };
