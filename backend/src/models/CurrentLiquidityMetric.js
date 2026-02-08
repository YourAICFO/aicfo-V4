const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CurrentLiquidityMetric = sequelize.define('CurrentLiquidityMetric', {
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
  avgNetCashOutflow3m: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'avg_net_cash_outflow_3m'
  },
  cashRunwayMonths: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'cash_runway_months'
  }
}, {
  tableName: 'current_liquidity_metrics',
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
  underscored: true,
  indexes: [
    { unique: true, fields: ['company_id'] }
  ]
});

module.exports = { CurrentLiquidityMetric };
