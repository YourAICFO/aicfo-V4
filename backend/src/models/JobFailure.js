'use strict';

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const JobFailure = sequelize.define('JobFailure', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  jobId: { type: DataTypes.STRING, allowNull: false, field: 'job_id' },
  jobName: { type: DataTypes.STRING, allowNull: false, field: 'job_name' },
  queueName: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ai-cfo-jobs', field: 'queue_name' },
  companyId: { type: DataTypes.UUID, field: 'company_id' },
  payload: { type: DataTypes.JSONB, defaultValue: {} },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  failedReason: { type: DataTypes.TEXT, field: 'failed_reason' },
  stackTrace: { type: DataTypes.TEXT, field: 'stack_trace' },
  firstFailedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'first_failed_at' },
  lastFailedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'last_failed_at' },
  resolvedAt: { type: DataTypes.DATE, field: 'resolved_at' },
}, {
  tableName: 'job_failures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = { JobFailure };
