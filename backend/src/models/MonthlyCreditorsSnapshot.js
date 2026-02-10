const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyCreditorsSnapshot = sequelize.define('MonthlyCreditorsSnapshot', {
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
  creditorName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'creditor_name'
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
  outstandingAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'outstanding_amount'
  }
}, {
  tableName: 'monthly_creditors_snapshot',
  timestamps: false
});

module.exports = { MonthlyCreditorsSnapshot };
