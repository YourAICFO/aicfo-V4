const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  industry: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR'
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'owner_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'India'
  },
  pincode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  gstNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'gst_number'
  },
  panNumber: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'pan_number'
  },
  financialYearStart: {
    type: DataTypes.INTEGER,
    defaultValue: 4,
    field: 'financial_year_start'
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
  subscriptionStatus: {
    type: DataTypes.ENUM('trial', 'active', 'expired'),
    allowNull: true,
    field: 'subscription_status'
  }
}, {
  tableName: 'companies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = { Company };
