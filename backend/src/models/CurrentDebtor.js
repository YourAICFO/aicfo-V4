const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CurrentDebtor = sequelize.define('CurrentDebtor', {
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
  debtorName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'debtor_name'
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'current_debtors',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { unique: true, fields: ['company_id', 'debtor_name'] }
  ]
});

module.exports = { CurrentDebtor };
