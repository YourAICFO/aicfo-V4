const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOQuestionRule = sequelize.define('CFOQuestionRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  questionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'question_id'
  },
  condition: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  severity: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  insightTemplate: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'insight_template'
  }
}, {
  tableName: 'cfo_question_rules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['question_id'] },
    { unique: true, fields: ['question_id', 'severity', 'insight_template'] }
  ]
});

module.exports = { CFOQuestionRule };
