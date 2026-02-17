const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BillingPlan = sequelize.define('BillingPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  priceAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'price_amount'
  },
  currency: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'INR'
  },
  interval: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'month'
  },
  featuresJson: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'features_json'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'billing_plans',
  timestamps: false,
  underscored: true
});

module.exports = { BillingPlan };
