const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const IntegrationSyncRun = sequelize.define('IntegrationSyncRun', {
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
  integrationType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'tally',
    field: 'integration_type'
  },
  connectorClientId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'connector_client_id',
    references: {
      model: 'connector_clients',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('queued', 'running', 'success', 'failed', 'partial'),
    allowNull: false
  },
  stage: {
    type: DataTypes.ENUM('connect', 'discover', 'fetch', 'upload', 'normalize', 'snapshot', 'done'),
    allowNull: false
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'started_at'
  },
  finishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'finished_at'
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_error'
  },
  lastErrorAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_error_at'
  },
  stats: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'integration_sync_runs',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      fields: ['company_id', 'started_at']
    },
    {
      fields: ['company_id', 'status']
    },
    {
      fields: ['connector_client_id']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = { IntegrationSyncRun };