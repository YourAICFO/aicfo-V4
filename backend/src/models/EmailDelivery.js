const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmailDelivery = sequelize.define('EmailDelivery', {
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
  type: {
    type: DataTypes.ENUM('weekly', 'monthly'),
    allowNull: false
  },
  periodStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_start'
  },
  periodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_end'
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at'
  },
  toEmailsJson: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'to_emails_json'
  },
  subject: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  bodyText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'body_text'
  },
  metaJson: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    field: 'meta_json'
  },
  status: {
    type: DataTypes.ENUM('sent', 'failed', 'skipped'),
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'email_deliveries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { unique: true, fields: ['company_id', 'type', 'period_start', 'period_end'] },
    { fields: ['company_id', 'sent_at'] }
  ]
});

module.exports = { EmailDelivery };
