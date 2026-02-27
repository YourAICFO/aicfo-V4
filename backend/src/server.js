require('dotenv').config();
const { loadEnv } = require('./config/env');
const env = loadEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const path = require('path');

const { sequelize } = require('./models');
const { logger, logError } = require('./utils/logger');
const { requestContext } = require('./middleware/requestContext');
const { authLimiter, connectorLimiter, aiLimiter } = require('./middleware/rateLimit');
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
const adminConnectorRoutes = require('./routes/adminConnector');
const adminIngestionRoutes = require('./routes/adminIngestion');
const partyRoutes = require('./routes/party');
const syncStatusRoutes = require('./routes/syncStatus');
const debtorsRoutes = require('./routes/debtors');
const creditorsRoutes = require('./routes/creditors');
const devToolsRoutes = require('./routes/devTools');
const downloadRoutes = require('./routes/download');
const connectorRoutes = require('./routes/connector');
const { billingRouter, handleBillingWebhook } = require('./routes/billing');
const settingsNotificationsRoutes = require('./routes/settingsNotifications');
const adminQueueRoutes = require('./routes/adminQueue');


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
   CORS — environment-aware allowlist
   Production: ONLY origins listed in ALLOWED_ORIGINS (comma-separated).
   Development/test: localhost on common dev ports + any ALLOWED_ORIGINS.
================================ */
const isProdCors = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
const explicitOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const localhostPattern = /^https?:\/\/localhost(:\d+)?$/;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (explicitOrigins.includes(origin)) return callback(null, true);

    if (!isProdCors && localhostPattern.test(origin)) return callback(null, true);

    callback(new Error(`CORS policy violation: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
// Keep webhook raw-body route explicit and ahead of express.json for signature verification.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleBillingWebhook);
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
   Connector discovery (no auth)
   GET /.well-known/aicfo-connector.json → 200 JSON with apiBaseUrl, version.
   Used by Windows connector to resolve API URL; avoid WAF/redirect issues on aicfo.in.
================================ */
const discoveryApiBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_URL || 'https://web-production-be25.up.railway.app';
app.get('/.well-known/aicfo-connector.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    apiBaseUrl: discoveryApiBaseUrl.replace(/\/$/, ''),
    latestConnectorVersion: '1.0.0',
    minConnectorVersion: '1.0.0',
    downloadUrl: process.env.CONNECTOR_DOWNLOAD_URL || `${discoveryApiBaseUrl}/download/connector`,
    releaseNotesUrl: '',
    timestamp: new Date().toISOString(),
  });
});

/* ===============================
   API routes
================================ */
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
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
app.use('/api/admin/connector', adminConnectorRoutes);
app.use('/api/admin/ingestion', adminIngestionRoutes);
app.use('/api/admin/queue', adminQueueRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);
app.use('/download', downloadRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/connector', connectorLimiter, connectorRoutes);
app.use('/api/billing', billingRouter);
app.use('/api/settings/notifications', settingsNotificationsRoutes);


/* ===============================
   Static file serving for frontend (Production)
================================ */
if (process.env.NODE_ENV === 'production') {
  // Check if frontend static files exist (backend/public, filled by Docker build or deploy)
  const frontendPath = path.join(__dirname, '..', 'public');
  const fs = require('fs');
  
  try {
    if (fs.existsSync(frontendPath)) {
      // Serve static files from frontend build if available
      app.use(express.static(frontendPath));
      
      // Handle React Router - serve index.html for all non-API routes
      app.get('*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/download')) {
          return res.status(404).json({
            success: false,
            error: 'Endpoint not found',
          });
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    } else {
      logger.info('Frontend static files not found, serving API-only mode');
      // API-only mode - serve backend info for root path
      app.get('/', (req, res) => {
        res.json({
          name: 'AI CFO Platform API',
          version: '1.0.0',
          status: 'running',
          health: '/health',
          environment: 'production',
          mode: 'api-only',
          message: 'Backend API is running. Frontend should be deployed separately or frontend files are missing.'
        });
      });
    }
  } catch (err) {
    logger.warn('Error checking frontend static files, serving API-only mode');
    // API-only mode - serve backend info for root path
    app.get('/', (req, res) => {
      res.json({
        name: 'AI CFO Platform API',
        version: '1.0.0',
        status: 'running',
        health: '/health',
        environment: 'production',
        mode: 'api-only',
        message: 'Backend API is running. Frontend should be deployed separately or frontend files are missing.'
      });
    });
  }
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

    const { testConnection, isQueueResilientMode } = require('./config/redis');
    if (!isQueueResilientMode()) {
      try {
        await testConnection();
      } catch (err) {
        logger.error({ err }, 'Redis is required but unavailable. Set QUEUE_RESILIENT_MODE=true to run without Redis.');
        process.exit(1);
      }
    } else if (process.env.NODE_ENV === 'development') {
      logger.info('Development: Redis optional (queue resilient mode).');
    }

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

    if (env.NODE_ENV === 'development' && env.ALLOW_SEQUELIZE_SYNC) {
      await sequelize.sync({ alter: false });
      logger.info('Database models synchronized (ALLOW_SEQUELIZE_SYNC=true).');
    } else if (env.NODE_ENV === 'staging' || env.NODE_ENV === 'production') {
      logger.info('sequelize.sync skipped — use db:migrate for schema changes.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT }, 'Server running');
      logger.info({ environment: process.env.NODE_ENV || 'development' }, 'Environment');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    if (process.env.NODE_ENV !== 'production') {
      const errStr = JSON.stringify(error && error.original ? error.original : error);
      const has5432 = errStr.includes('5432') || (error.parent && String(error.parent.message || '').includes('5432'));
      const has6379 = errStr.includes('6379');
      if (has5432 || errStr.includes('ECONNREFUSED')) {
        console.error('');
        console.error('Hint: Ensure PostgreSQL is running and DATABASE_URL is correct.');
        console.error('  Example: DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/aicfo');
        console.error('  On Windows use 127.0.0.1 instead of localhost to avoid IPv6 issues.');
      }
      if (has6379) {
        console.error('Hint: Start Redis, or in development Redis is optional (queue resilient mode is default).');
      }
      console.error('');
    }
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
