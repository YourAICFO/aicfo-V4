const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConnectorClient = sequelize.define('ConnectorClient', {
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
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'device_id'
  },
  deviceName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'device_name'
  },
  os: {
    type: DataTypes.STRING,
    allowNull: true
  },
  appVersion: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'app_version'
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_seen_at'
  }
}, {
  tableName: 'connector_clients',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['company_id', 'device_id']
    },
    {
      fields: ['company_id']
    }
  ]
});

module.exports = { ConnectorClient };