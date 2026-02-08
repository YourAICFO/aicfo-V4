const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CurrentLoan = sequelize.define('CurrentLoan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: { model: 'companies', key: 'id' }
  },
  loanName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'loan_name'
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'current_loans',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { unique: true, fields: ['company_id', 'loan_name'] }
  ]
});

module.exports = { CurrentLoan };
