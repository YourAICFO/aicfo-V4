const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize } = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const transactionRoutes = require('./routes/transactions');
const cashBalanceRoutes = require('./routes/cashBalance');
const integrationRoutes = require('./routes/integrations');
const jobRoutes = require('./routes/jobs');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const financeRoutes = require('./routes/finance');
const adminRoutes = require('./routes/admin');
const cfoQuestionRoutes = require('./routes/cfoQuestions');
const adminMetricsRoutes = require('./routes/adminMetrics');
const partyRoutes = require('./routes/party');
const syncStatusRoutes = require('./routes/syncStatus');
const debtorsRoutes = require('./routes/debtors');
const creditorsRoutes = require('./routes/creditors');


const app = express();
const PORT = process.env.PORT || 5000;

/* ===============================
   Security middleware
================================ */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

/* ===============================
   CORS — FIXED (IMPORTANT)
================================ */
app.use(
  cors({
    origin: [
      'https://web-production-7440b.up.railway.app', // FRONTEND (Railway)
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);

/* ===============================
   Logging
================================ */
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')
);

/* ===============================
   Body parsing
================================ */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ===============================
   Health check (Railway)
================================ */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/* ===============================
   API routes
================================ */
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cash-balance', cashBalanceRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/cfo', cfoQuestionRoutes);
app.use('/api/party', partyRoutes);
app.use('/api/sync', syncStatusRoutes);
app.use('/api/debtors', debtorsRoutes);
app.use('/api/creditors', creditorsRoutes);
app.use('/api/admin/metrics', adminMetricsRoutes);
app.use('/admin', adminRoutes);

/* ===============================
   Root
================================ */
app.get('/', (req, res) => {
  res.json({
    name: 'AI CFO Platform API',
    version: '1.0.0',
    status: 'running',
    health: '/health',
  });
});

/* ===============================
   404 handler
================================ */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

/* ===============================
   Global error handler
================================ */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && {
      message: err.message,
      stack: err.stack,
    }),
  });
});

/* ===============================
   Start server
================================ */
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    if (sequelize.getDialect() === 'postgres') {
      try {
        await sequelize.query(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_type t
              JOIN pg_enum e ON t.oid = e.enumtypid
              WHERE t.typname = 'enum_financial_transactions_type'
                AND e.enumlabel = 'OPENING_BALANCE'
            ) THEN
              ALTER TYPE "enum_financial_transactions_type" ADD VALUE 'OPENING_BALANCE';
            END IF;
          END $$;
        `);
      } catch (error) {
        console.warn('Failed to ensure OPENING_BALANCE enum value:', error.message);
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: false });
      console.log('Database models synchronized.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

/* ===============================
   Graceful shutdown
================================ */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

startServer();

module.exports = app;
