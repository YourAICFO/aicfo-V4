const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOQuestionResult = sequelize.define('CFOQuestionResult', {
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    primaryKey: true
  },
  questionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'question_id',
    primaryKey: true
  },
  severity: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  result: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  computedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'computed_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'cfo_question_results',
  timestamps: false,
  underscored: true
});

module.exports = { CFOQuestionResult };
