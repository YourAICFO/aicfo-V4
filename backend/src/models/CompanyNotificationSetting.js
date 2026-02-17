const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanyNotificationSetting = sequelize.define('CompanyNotificationSetting', {
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    field: 'company_id'
  },
  enabledWeekly: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'enabled_weekly'
  },
  weeklyDayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'weekly_day_of_week'
  },
  weeklyTimeHhmm: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: '09:00',
    field: 'weekly_time_hhmm'
  },
  enabledMonthly: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'enabled_monthly'
  },
  monthlyDayOfMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'monthly_day_of_month'
  },
  monthlyTimeHhmm: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: '09:00',
    field: 'monthly_time_hhmm'
  },
  timezone: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: 'Asia/Kolkata'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'company_notification_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = { CompanyNotificationSetting };
