const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
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
  invoiceNo: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
    field: 'invoice_no'
  },
  periodStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_start'
  },
  periodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_end'
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  taxAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'tax_amount'
  },
  total: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  currency: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'INR'
  },
  status: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  issuedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'issued_at',
    defaultValue: DataTypes.NOW
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at'
  },
  gateway: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'razorpay'
  },
  gatewayPaymentId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'gateway_payment_id'
  },
  gatewayInvoiceId: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'gateway_invoice_id'
  },
  metaJson: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'meta_json'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'invoices',
  timestamps: false,
  underscored: true,
  indexes: [{ fields: ['company_id', 'issued_at'] }]
});

module.exports = { Invoice };
