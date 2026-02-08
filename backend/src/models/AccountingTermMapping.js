const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountingTermMapping = sequelize.define('AccountingTermMapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sourceSystem: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'source_system'
  },
  sourceTerm: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'source_term'
  },
  normalizedTerm: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'normalized_term'
  },
  normalizedType: {
    type: DataTypes.ENUM('REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY'),
    allowNull: false,
    field: 'normalized_type'
  }
}, {
  tableName: 'accounting_term_mapping',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { fields: ['source_system'] },
    { fields: ['source_term'] }
  ]
});

module.exports = { AccountingTermMapping };
