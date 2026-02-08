const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CFOQuestion = sequelize.define('CFOQuestion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'cfo_questions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { unique: true, fields: ['code'] }
  ]
});

module.exports = { CFOQuestion };
