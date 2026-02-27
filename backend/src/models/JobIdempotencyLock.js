'use strict';

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const JobIdempotencyLock = sequelize.define('JobIdempotencyLock', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
  jobKey: { type: DataTypes.STRING, allowNull: false, field: 'job_key' },
  scopeKey: { type: DataTypes.STRING, allowNull: false, field: 'scope_key' },
  payloadHash: { type: DataTypes.STRING, field: 'payload_hash' },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'running' },
  lockedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'locked_at' },
  completedAt: { type: DataTypes.DATE, field: 'completed_at' },
  lastJobId: { type: DataTypes.STRING, field: 'last_job_id' },
  lastError: { type: DataTypes.TEXT, field: 'last_error' },
}, {
  tableName: 'job_idempotency_locks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = { JobIdempotencyLock };
