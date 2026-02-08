const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdminAIQuestion = sequelize.define('AdminAIQuestion', {
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
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'admin_ai_questions',
  timestamps: false
});

module.exports = { AdminAIQuestion };
