const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AIChatThread = sequelize.define('AIChatThread', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id'
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'ai_chat_threads',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = { AIChatThread };
