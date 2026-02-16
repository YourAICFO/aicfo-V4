const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConnectorDevice = sequelize.define('ConnectorDevice', {
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
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  deviceId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'device_id'
  },
  deviceName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'device_name'
  },
  deviceTokenHash: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'device_token_hash'
  },
  status: {
    type: DataTypes.ENUM('active', 'revoked'),
    allowNull: false,
    defaultValue: 'active'
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_seen_at'
  }
}, {
  tableName: 'connector_devices',
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
      fields: ['device_token_hash']
    }
  ]
});

module.exports = { ConnectorDevice };

