const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOAlert = sequelize.define('CFOAlert', {
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
  alertType: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'alert_type'
  },
  severity: {
    type: DataTypes.STRING(16),
    allowNull: false
  },
  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'generated_at',
    defaultValue: DataTypes.NOW
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'cfo_alerts',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['generated_at'] }
  ]
});

module.exports = { CFOAlert };
