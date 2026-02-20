const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PLRemarks = sequelize.define('PLRemarks', {
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
  month: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  aiDraftText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'ai_draft_text'
  },
  aiDraftUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'ai_draft_updated_at'
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'updated_by',
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'pl_remarks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { unique: true, fields: ['company_id', 'month'] }
  ]
});

module.exports = { PLRemarks };
