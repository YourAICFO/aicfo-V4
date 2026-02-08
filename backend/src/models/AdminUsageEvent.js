const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdminUsageEvent = sequelize.define('AdminUsageEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'company_id'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id'
  },
  eventType: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'event_type'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'admin_usage_events',
  timestamps: false
});

module.exports = { AdminUsageEvent };
