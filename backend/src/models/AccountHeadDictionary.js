const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountHeadDictionary = sequelize.define('AccountHeadDictionary', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  canonicalType: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'canonical_type'
  },
  canonicalSubtype: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'canonical_subtype'
  },
  matchPattern: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'match_pattern'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'createdAt',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updatedAt',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'account_head_dictionary',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

module.exports = { AccountHeadDictionary };
