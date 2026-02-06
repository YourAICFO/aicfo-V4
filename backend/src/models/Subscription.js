const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subscription = sequelize.define('Subscription', {
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
  planType: {
    type: DataTypes.ENUM('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'),
    defaultValue: 'FREE',
    field: 'plan_type'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING'),
    defaultValue: 'ACTIVE'
  },
  subscriptionStatus: {
    type: DataTypes.ENUM('trial', 'active', 'expired'),
    defaultValue: 'trial',
    field: 'subscription_status'
  },
  trialStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_start_date'
  },
  trialEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_end_date'
  },
  accountLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'account_locked'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'start_date'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'end_date'
  },
  stripeCustomerId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'stripe_customer_id'
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'stripe_subscription_id'
  },
  maxTransactions: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    field: 'max_transactions'
  },
  maxIntegrations: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'max_integrations'
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: {
      manualEntry: true,
      aiInsights: false,
      aiChat: false,
      tally: false,
      zoho: false,
      quickbooks: false,
      alerts: false,
      exports: false
    }
  }
}, {
  tableName: 'subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['trial_end_date'] }
  ]
});

module.exports = { Subscription };
