const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyRevenueBreakdown = sequelize.define('MonthlyRevenueBreakdown', {
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
  month: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  revenueName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'revenue_name'
  },
  normalizedRevenueCategory: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'normalized_revenue_category'
  },
  rawHeadName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'raw_head_name'
  },
  canonicalType: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'canonical_type'
  },
  canonicalSubtype: {
    type: DataTypes.STRING(128),
    allowNull: true,
    field: 'canonical_subtype'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'monthly_revenue_breakdown',
  timestamps: false
});

module.exports = { MonthlyRevenueBreakdown };
