const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AlertState = sequelize.define('AlertState', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: { model: 'companies', key: 'id' }
  },
  ruleKey: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'rule_key'
  },
  snoozedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'snoozed_until'
  },
  dismissedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'dismissed_at'
  },
  lastConditionHash: {
    type: DataTypes.STRING(256),
    allowNull: true,
    field: 'last_condition_hash'
  }
}, {
  tableName: 'alert_states',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { unique: true, fields: ['company_id', 'rule_key'] }
  ]
});

module.exports = { AlertState };
