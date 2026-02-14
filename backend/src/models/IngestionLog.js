const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const IngestionLog = sequelize.define('IngestionLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'companies',
      key: 'id',
    },
  },
  source: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['tally', 'zoho', 'quickbooks', 'manual', 'connector']],
    },
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'received',
    validate: {
      isIn: [['received', 'processing', 'processed', 'failed', 'error']],
    },
  },
  errorMessage: {
    type: DataTypes.TEXT,
    field: 'error_message',
    allowNull: true,
  },
  receivedAt: {
    type: DataTypes.DATE,
    field: 'received_at',
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  processedAt: {
    type: DataTypes.DATE,
    field: 'processed_at',
    allowNull: true,
  },
  errorAt: {
    type: DataTypes.DATE,
    field: 'error_at',
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'ingestion_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['company_id'],
    },
    {
      fields: ['source'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['received_at'],
    },
    {
      fields: ['company_id', 'received_at'],
    },
  ],
});

module.exports = { IngestionLog };