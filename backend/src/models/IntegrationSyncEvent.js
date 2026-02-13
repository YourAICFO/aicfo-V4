const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const IntegrationSyncEvent = sequelize.define('IntegrationSyncEvent', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  runId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'run_id',
    references: {
      model: 'integration_sync_runs',
      key: 'id'
    }
  },
  time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  level: {
    type: DataTypes.ENUM('info', 'warn', 'error'),
    allowNull: false
  },
  event: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'integration_sync_events',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      fields: ['run_id', 'time']
    },
    {
      fields: ['level', 'time']
    },
    {
      fields: ['time']
    }
  ]
});

module.exports = { IntegrationSyncEvent };