const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AppLog = sequelize.define('AppLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  level: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  service: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  runId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'run_id'
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'company_id'
  },
  event: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  errorStack: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_stack'
  }
}, {
  tableName: 'app_logs',
  timestamps: false
});

module.exports = { AppLog };
