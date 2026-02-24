const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AiUsageDaily = sequelize.define('AiUsageDaily', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  featureKey: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'feature_key',
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'ai_usage_daily',
  timestamps: false,
  underscored: true,
  indexes: [
    { unique: true, fields: ['company_id', 'date', 'feature_key'] },
    { fields: ['company_id', 'date'] },
    { fields: ['company_id', 'feature_key'] },
  ],
});

module.exports = { AiUsageDaily };
