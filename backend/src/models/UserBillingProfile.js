const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserBillingProfile = sequelize.define('UserBillingProfile', {
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    field: 'user_id'
  },
  trialStartedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_started_at'
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_ends_at'
  },
  hasUsedTrial: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'has_used_trial'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_billing_profile',
  timestamps: false,
  underscored: true
});

module.exports = { UserBillingProfile };
