const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanySubscription = sequelize.define('CompanySubscription', {
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
  planCode: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'plan_code'
  },
  status: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'trial_ends_at'
  },
  currentPeriodStart: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'current_period_start'
  },
  currentPeriodEnd: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'current_period_end'
  },
  gateway: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'razorpay'
  },
  gatewayCustomerId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'gateway_customer_id'
  },
  gatewaySubscriptionId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'gateway_subscription_id'
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
  tableName: 'company_subscriptions',
  timestamps: false,
  underscored: true,
  indexes: [{ fields: ['company_id'] }]
});

module.exports = { CompanySubscription };
