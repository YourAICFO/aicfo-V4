const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'last_name'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_verified'
  },
  verificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'verification_token'
  },
  resetToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'reset_token'
  },
  resetTokenExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reset_token_expiry'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = { User };
