const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountingMonth = sequelize.define('AccountingMonth', {
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
  isClosed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_closed'
  },
  sourceLastSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'source_last_synced_at'
  }
}, {
  tableName: 'accounting_months',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['month'] }
  ]
});

module.exports = { AccountingMonth };
