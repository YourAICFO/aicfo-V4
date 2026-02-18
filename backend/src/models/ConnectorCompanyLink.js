const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConnectorCompanyLink = sequelize.define('ConnectorCompanyLink', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  tallyCompanyId: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'tally_company_id'
  },
  tallyCompanyName: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'tally_company_name'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_sync_at'
  },
  lastSyncStatus: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_sync_status'
  },
  lastSyncError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_sync_error'
  }
}, {
  tableName: 'connector_company_links',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = { ConnectorCompanyLink };
