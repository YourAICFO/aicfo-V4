const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');
const { logger, logError } = require('./utils/logger');
const { requestContext } = require('./middleware/requestContext');
const { initSentry, sentryRequestHandler, sentryErrorHandler } = require('./utils/sentry');

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
const devToolsRoutes = require('./routes/devTools');
const downloadRoutes = require('./routes/download');


const app = express();
const PORT = process.env.PORT || 5000;
initSentry({ serviceName: 'ai-cfo-api' });

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
   CORS — DYNAMIC (Production-ready)
================================ */
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // For development, allow localhost origins
      if (origin.includes('localhost')) {
        return callback(null, true);
      }
      
      callback(new Error(`CORS policy violation: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400 // 24 hours
  })
);

/* ===============================
   Request context + logging
================================ */
app.use(requestContext);
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      run_id: req.run_id,
      user_id: req.user?.id || null,
      company_id: req.company?.id || req.companyId || null
    })
  })
);
app.use(sentryRequestHandler);

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
app.use('/api/dev', devToolsRoutes);
app.use('/api/admin/metrics', adminMetricsRoutes);
app.use('/admin', adminRoutes);
app.use('/download', downloadRoutes);

/* ===============================
   Static file serving for frontend (Production)
================================ */
if (process.env.NODE_ENV === 'production') {
  // Serve static files from frontend build
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  // Handle React Router - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/download')) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
} else {
  /* ===============================
     Root (Development)
  ================================ */
  app.get('/', (req, res) => {
    res.json({
      name: 'AI CFO Platform API',
      version: '1.0.0',
      status: 'running',
      health: '/health',
      environment: 'development',
    });
  });
}

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
app.use(sentryErrorHandler);
app.use((err, req, res, next) => {
  const runId = req.run_id || null;
  if (req.log) {
    req.log.error({ err, run_id: runId }, 'Unhandled error');
  } else {
    logger.error({ err, run_id: runId }, 'Unhandled error');
  }
  logError({
    run_id: runId,
    company_id: req.company?.id || req.companyId || null,
    event: 'api_unhandled_error',
    service: 'ai-cfo-api'
  }, 'Unhandled API error', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    run_id: runId,
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
    logger.info('Database connection established successfully.');

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
        logger.warn({ err: error }, 'Failed to ensure OPENING_BALANCE enum value');
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: false });
      logger.info('Database models synchronized.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT }, 'Server running');
      logger.info({ environment: process.env.NODE_ENV || 'development' }, 'Environment');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

/* ===============================
   Graceful shutdown
================================ */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

startServer();

module.exports = app;
