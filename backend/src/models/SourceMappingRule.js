const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SourceMappingRule = sequelize.define('SourceMappingRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sourceSystem: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'source_system'
  },
  matchField: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'match_field'
  },
  matchValue: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'match_value'
  },
  normalizedType: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'normalized_type'
  },
  normalizedBucket: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'normalized_bucket'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'source_mapping_rules',
  timestamps: false
});

module.exports = { SourceMappingRule };
