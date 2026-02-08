const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOQuestionMetric = sequelize.define('CFOQuestionMetric', {
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
  metricKey: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'metric_key'
  },
  timeScope: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'time_scope'
  }
}, {
  tableName: 'cfo_question_metrics',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['question_id'] },
    { unique: true, fields: ['question_id', 'metric_key', 'time_scope'] }
  ]
});

module.exports = { CFOQuestionMetric };
