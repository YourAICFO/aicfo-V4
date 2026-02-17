const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AIChatMessage = sequelize.define('AIChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  threadId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'thread_id'
  },
  role: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      isIn: [['user', 'assistant']]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ai_chat_messages',
  timestamps: false,
  underscored: true
});

module.exports = { AIChatMessage };
