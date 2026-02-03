const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Integration = sequelize.define('Integration', {
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
  type: {
    type: DataTypes.ENUM('TALLY', 'ZOHO', 'QUICKBOOKS'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING'),
    defaultValue: 'DISCONNECTED'
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  credentials: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  lastSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_synced_at'
  },
  lastSyncStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'last_sync_status'
  },
  lastSyncError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_sync_error'
  },
  syncFrequency: {
    type: DataTypes.ENUM('MANUAL', 'HOURLY', 'DAILY'),
    defaultValue: 'MANUAL',
    field: 'sync_frequency'
  },
  companyName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'company_name'
  }
}, {
  tableName: 'integrations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = { Integration };
