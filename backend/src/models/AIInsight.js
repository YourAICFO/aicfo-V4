const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AIInsight = sequelize.define('AIInsight', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'companies',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('RUNWAY', 'REVENUE', 'EXPENSE', 'CASHFLOW', 'RISK', 'TREND', 'ANOMALY', 'RECOMMENDATION'),
    allowNull: false
  },
  riskLevel: {
    type: DataTypes.ENUM('GREEN', 'AMBER', 'RED'),
    allowNull: false,
    field: 'risk_level'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dataPoints: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'data_points'
  },
  recommendations: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_read'
  },
  isDismissed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_dismissed'
  },
  generatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'generated_at'
  }
}, {
  tableName: 'ai_insights',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['risk_level'] },
    { fields: ['type'] },
    { fields: ['is_read'] }
  ]
});

module.exports = { AIInsight };
