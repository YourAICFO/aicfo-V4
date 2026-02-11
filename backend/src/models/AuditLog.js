const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
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
  actorType: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'actor_type'
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'actor_id'
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id'
  },
  action: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  entityType: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'entity_type'
  },
  entityId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'entity_id'
  },
  diff: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  runId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'run_id'
  }
}, {
  tableName: 'audit_log',
  timestamps: false
});

module.exports = { AuditLog };
