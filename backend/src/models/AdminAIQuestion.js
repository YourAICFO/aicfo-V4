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
  detectedQuestionKey: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'detected_question_key'
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'failure_reason'
  },
  metricsUsedJson: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'metrics_used_json',
    defaultValue: {}
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'createdAt',
    defaultValue: DataTypes.NOW
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'admin_ai_questions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

module.exports = { AdminAIQuestion };
