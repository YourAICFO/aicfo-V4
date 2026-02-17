const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UsageDaily = sequelize.define('UsageDaily', {
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
  day: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'usage_daily',
  timestamps: false,
  underscored: true,
  indexes: [{ unique: true, fields: ['company_id', 'day'] }]
});

module.exports = { UsageDaily };
