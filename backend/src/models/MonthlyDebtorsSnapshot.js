const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyDebtorsSnapshot = sequelize.define('MonthlyDebtorsSnapshot', {
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
  debtorName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'debtor_name'
  },
  outstandingAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'outstanding_amount'
  }
}, {
  tableName: 'monthly_debtors_snapshot',
  timestamps: false
});

module.exports = { MonthlyDebtorsSnapshot };
