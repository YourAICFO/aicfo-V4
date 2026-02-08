const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOMetric = sequelize.define('CFOMetric', {
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
  metricKey: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'metric_key'
  },
  metricValue: {
    type: DataTypes.DECIMAL(20, 4),
    allowNull: true,
    field: 'metric_value'
  },
  metricText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'metric_text'
  },
  timeScope: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'live',
    field: 'time_scope'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'cfo_metrics',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['metric_key'] },
    { unique: true, fields: ['company_id', 'metric_key', 'time_scope'] }
  ]
});

module.exports = { CFOMetric };
