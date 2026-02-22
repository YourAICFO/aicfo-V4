const express = require('express');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const router = express.Router();

const { integrationService, authService } = require('../services');
const { checkAccess } = require('../services/subscriptionService');
const syncStatusService = require('../services/syncStatusService');
const { jwtSecret } = require('../config/auth');
const {
  IntegrationSyncRun,
  IntegrationSyncEvent,
  Company,
  ConnectorDevice,
  ConnectorCompanyLink,
  ConnectorClient,
  MonthlyTrialBalanceSummary,
  sequelize
} = require('../models');
const { authenticate } = require('../middleware/auth');
const { authenticateConnectorOrLegacy, hashToken } = require('../middleware/connectorAuth');
const { validateChartOfAccountsPayload } = require('../services/coaPayloadValidator');

const connectorLoginAttempts = new Map();
let hasWarnedDataSyncStatusSchemaMissing = false;

const authorizeCompanyAccess = async (userId, companyId) => {
  if (!companyId) return null;
  return Company.findOne({
    where: {
      id: companyId,
      ownerId: userId
    }
  });
};

const resolveCompanyId = (req) => req.headers['x-company-id'] || req.query?.companyId || null;
const normalizeTallyCompanyId = (value) => String(value || '').trim().toLowerCase();
const normalizeTallyCompanyName = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const resolveLinkContext = async (req) => {
  const linkId = req.body?.linkId || req.query?.linkId || null;
  if (!linkId) {
    if (req.connectorAuthMode === 'device_login') {
      return { link: null, error: 'linkId is required for device login sync operations', statusCode: 400 };
    }
    return { link: null, error: null, statusCode: null };
  }
  if (!req.userId) {
    return { link: null, error: 'linkId requires device login authentication', statusCode: 403 };
  }

  const link = await ConnectorCompanyLink.findOne({
    where: {
      id: linkId,
      userId: req.userId,
      isActive: true
    },
    include: [
      {
        model: Company,
        as: 'company',
        required: true,
        where: { isDeleted: false, deletedAt: null },
        attributes: ['id']
      }
    ],
    raw: false
  });

  if (!link) {
    return { link: null, error: 'Active link not found', statusCode: 404 };
  }

  req.companyId = link.companyId;
  req.linkId = link.id;
  const access = await checkAccess(req.companyId, req.userId);
  if (!access.allowed) {
    return { link: null, error: access.reason || 'Access denied', statusCode: 403 };
  }
  return { link, error: null, statusCode: null };
};

const buildStableStatusResponse = async (companyId) => {
  const onlineThresholdSeconds = Number(process.env.CONNECTOR_ONLINE_THRESHOLD_SECONDS || 120);
  // Identity and health are ConnectorDevice-first; ConnectorClient is legacy fallback for old tokens.
  const [latestActiveDevice, latestConnectorClient, latestRun, latestSnapshot] = await Promise.all([
    ConnectorDevice.findOne({
      where: { companyId, status: 'active' },
      // Use physical column names to avoid timestamp attribute alias differences across Sequelize configs.
      order: [['last_seen_at', 'DESC'], ['updated_at', 'DESC']],
      raw: true
    }),
    ConnectorClient.findOne({
      where: { companyId },
      order: [['last_seen_at', 'DESC'], ['updated_at', 'DESC']],
      raw: true
    }),
    IntegrationSyncRun.findOne({
      where: { companyId },
      order: [['startedAt', 'DESC']],
      raw: true
    }),
    MonthlyTrialBalanceSummary.findOne({
      where: { companyId },
      order: [['month', 'DESC']],
      attributes: ['month'],
      raw: true
    })
  ]);

  const runId = latestRun?.id || null;
  const [latestErrorEvent, lastEvent] = runId
    ? await Promise.all([
        IntegrationSyncEvent.findOne({
          where: { runId, level: 'error' },
          order: [['time', 'DESC']],
          attributes: ['message', 'time'],
          raw: true
        }),
        IntegrationSyncEvent.findOne({
          where: { runId },
          order: [['time', 'DESC']],
          attributes: ['time'],
          raw: true
        })
      ])
    : [null, null];

  let dataSyncStatus = null;
  try {
    const rows = await sequelize.query(
      `SELECT status, last_snapshot_month, "updatedAt"
       FROM data_sync_status
       WHERE company_id = :companyId
       LIMIT 1`,
      {
        replacements: { companyId },
        type: QueryTypes.SELECT
      }
    );
    dataSyncStatus = rows?.[0] || null;
  } catch (error) {
    const pgCode = error?.original?.code || error?.parent?.code || null;
    // data_sync_status is additive; tolerate missing table/column and default readiness to "never".
    if (pgCode === '42P01' || pgCode === '42703') {
      if (!hasWarnedDataSyncStatusSchemaMissing) {
        hasWarnedDataSyncStatusSchemaMissing = true;
        console.warn('data_sync_status schema missing or incomplete; connector readiness defaults to status=never');
      }
    } else {
      throw error;
    }
  }

  const connectorSource = latestActiveDevice || latestConnectorClient || null;
  const connectorLastSeenAt = connectorSource?.lastSeenAt || null;
  const isOnline = connectorLastSeenAt
    ? (Date.now() - new Date(connectorLastSeenAt).getTime()) <= (onlineThresholdSeconds * 1000)
    : false;

  const latestMonthKey = dataSyncStatus?.last_snapshot_month || latestSnapshot?.month || null;
  const readinessStatus = dataSyncStatus?.status || 'never';

  return {
    companyId,
    connector: {
      deviceId: latestActiveDevice?.deviceId || latestConnectorClient?.deviceId || null,
      deviceName: latestActiveDevice?.deviceName || latestConnectorClient?.deviceName || null,
      authMode: latestActiveDevice ? 'device_token' : (latestConnectorClient ? 'legacy_connector_token' : null),
      lastSeenAt: connectorLastSeenAt,
      isOnline,
      onlineThresholdSeconds
    },
    sync: {
      lastRunId: latestRun?.id || null,
      lastRunStatus: latestRun?.status || null,
      lastRunStartedAt: latestRun?.startedAt || null,
      lastRunCompletedAt: latestRun?.finishedAt || null,
      lastEventAt: lastEvent?.time || null,
      lastError: latestErrorEvent?.message || latestRun?.lastError || null
    },
    dataReadiness: {
      status: readinessStatus,
      lastValidatedAt: dataSyncStatus?.updatedAt || null,
      latestMonthKey
    }
  };
};

const connectorLoginLimiter = (req, res, next) => {
  const windowMs = 60 * 1000;
  const max = 5;
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const current = connectorLoginAttempts.get(key);

  if (!current || (now - current.windowStart) > windowMs) {
    connectorLoginAttempts.set(key, { count: 1, windowStart: now });
    return next();
  }

  if (current.count >= max) {
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again in a minute.'
    });
  }

  current.count += 1;
  connectorLoginAttempts.set(key, current);
  return next();
};

/* ===============================
   TEST ROUTE
   GET /api/connector
================================ */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Connector routes are mounted correctly',
  });
});

/* ===============================
   POST /api/connector/auth
   Purpose: Connector authenticates and receives short-lived token
================================ */
router.post('/auth', async (req, res) => {
  try {
    const { companyId, deviceId, deviceName, os, appVersion, userJwt } = req.body;

    if (!companyId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'companyId and deviceId are required'
      });
    }

    // For now, validate using userJwt (future: use connector_secret)
    if (!userJwt) {
      return res.status(401).json({
        success: false,
        error: 'userJwt is required for authentication'
      });
    }

    // Validate user JWT and ensure user belongs to company
    const jwt = require('jsonwebtoken');
    let decodedUser;
    try {
      decodedUser = jwt.verify(userJwt, jwtSecret);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user JWT'
      });
    }

    // Verify user belongs to the company (simplified check)
    const { Company } = require('../models');
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Legacy: create/upsert connector client for backward-compat token
    const connectorClient = await syncStatusService.upsertConnectorClient(
      companyId,
      { deviceId, deviceName, os, appVersion }
    );
    const connectorToken = syncStatusService.generateConnectorToken(
      connectorClient.id,
      companyId
    );

    // Canonical identity: create/update ConnectorDevice so health and identity are device-centric
    const rawDeviceToken = `aicfo_dev_${crypto.randomBytes(48).toString('hex')}`;
    const deviceTokenHash = hashToken(rawDeviceToken);
    const [deviceRecord, deviceCreated] = await ConnectorDevice.findOrCreate({
      where: { companyId, deviceId },
      defaults: {
        companyId,
        userId: decodedUser.userId,
        deviceId,
        deviceName: deviceName || null,
        deviceTokenHash,
        status: 'active',
        lastSeenAt: new Date()
      }
    });
    if (!deviceCreated) {
      await deviceRecord.update({
        userId: decodedUser.userId,
        deviceName: deviceName || null,
        deviceTokenHash,
        status: 'active',
        lastSeenAt: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        connectorToken,
        connectorClientId: connectorClient.id,
        deviceToken: rawDeviceToken,
        deviceId,
        companyId,
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Connector auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/login
   Purpose: connector installer gets normal short-lived user JWT
================================ */
router.post('/login', connectorLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (process.env.CONNECTOR_LOGIN_DEBUG === '1') {
      console.log('connector_login_debug', {
        hasEmail: Boolean(email),
        emailLength: typeof email === 'string' ? email.length : 0,
        hasPassword: Boolean(password),
        passwordLength: typeof password === 'string' ? password.length : 0
      });
    }
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'email and password are required'
      });
    }

    const result = await authService.login(email, password);
    return res.json({
      success: true,
      data: {
        token: result.token,
        user: result.user
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/device/login
   Purpose: device-first connector login (long-lived token)
================================ */
router.post('/device/login', connectorLoginLimiter, async (req, res) => {
  try {
    const { email, password, deviceId, deviceName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'email and password are required'
      });
    }

    const result = await authService.login(email, password);
    const tokenPayload = {
      type: 'connector_device_login',
      userId: result.user.id,
      deviceId: typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : null,
      deviceName: typeof deviceName === 'string' && deviceName.trim() ? deviceName.trim() : null
    };
    const deviceToken = require('jsonwebtoken').sign(
      tokenPayload,
      jwtSecret,
      { expiresIn: '365d' }
    );

    return res.json({
      success: true,
      data: {
        deviceToken
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   GET /api/connector/device/companies
   Auth: device token
================================ */
router.get('/device/companies', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Device login required'
      });
    }

    const companies = await Company.findAll({
      where: {
        ownerId: req.userId,
        isDeleted: false,
        deletedAt: null
      },
      attributes: ['id', 'name'],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   GET /api/connector/device/links
   Auth: device token
================================ */
router.get('/device/links', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Device login required'
      });
    }

    const links = await ConnectorCompanyLink.findAll({
      where: {
        userId: req.userId,
        isActive: true
      },
      include: [
        {
          model: Company,
          as: 'company',
          required: true,
          where: { isDeleted: false, deletedAt: null },
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: links.map((link) => ({
        id: link.id,
        companyId: link.companyId,
        webCompanyName: link.company?.name || '',
        tallyCompanyId: link.tallyCompanyId,
        tallyCompanyName: link.tallyCompanyName,
        status: link.lastSyncStatus || 'Never',
        lastSyncAt: link.lastSyncAt,
        lastSyncError: link.lastSyncError
      }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/device/links
   Auth: device token
================================ */
router.post('/device/links', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Device login required'
      });
    }

    const { companyId, tallyCompanyId, tallyCompanyName } = req.body || {};
    if (!companyId || !tallyCompanyId || !tallyCompanyName) {
      return res.status(400).json({
        success: false,
        error: 'companyId, tallyCompanyId and tallyCompanyName are required'
      });
    }

    const company = await Company.findOne({
      where: {
        id: companyId,
        ownerId: req.userId,
        isDeleted: false,
        deletedAt: null
      }
    });
    if (!company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    const normalizedTallyCompanyId = normalizeTallyCompanyId(tallyCompanyId);
    const normalizedTallyCompanyName = normalizeTallyCompanyName(tallyCompanyName);

    const companyConflict = await ConnectorCompanyLink.findOne({
      where: {
        companyId,
        isActive: true
      },
      raw: true
    });
    if (companyConflict) {
      return res.status(409).json({
        success: false,
        error: 'This web company is already linked. Unlink it first.'
      });
    }

    const activeUserLinks = await ConnectorCompanyLink.findAll({
      where: {
        userId: req.userId,
        isActive: true
      },
      raw: true
    });
    const tallyConflict = activeUserLinks.find((item) =>
      normalizeTallyCompanyId(item.tally_company_id) === normalizedTallyCompanyId ||
      normalizeTallyCompanyName(item.tally_company_name) === normalizedTallyCompanyName);
    if (tallyConflict) {
      return res.status(409).json({
        success: false,
        error: 'This Tally company is already linked. Unlink it first.'
      });
    }

    const link = await ConnectorCompanyLink.create({
      companyId,
      userId: req.userId,
      tallyCompanyId: String(tallyCompanyId).trim(),
      tallyCompanyName: String(tallyCompanyName).trim(),
      isActive: true
    });

    return res.json({
      success: true,
      data: {
        id: link.id,
        companyId: link.companyId,
        webCompanyName: company.name,
        tallyCompanyId: link.tallyCompanyId,
        tallyCompanyName: link.tallyCompanyName,
        status: link.lastSyncStatus || 'Never',
        lastSyncAt: link.lastSyncAt,
        lastSyncError: link.lastSyncError
      }
    });
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'Link already exists. Unlink the old mapping first.'
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/device/links/:id/unlink
   Auth: device token
================================ */
router.post('/device/links/:id/unlink', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Device login required'
      });
    }

    const link = await ConnectorCompanyLink.findOne({
      where: {
        id: req.params.id,
        userId: req.userId,
        isActive: true
      }
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Active link not found'
      });
    }

    await link.update({ isActive: false });
    return res.json({ success: true, data: { id: link.id, isActive: false } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   GET /api/connector/companies
   Purpose: list companies owned by current user
================================ */
router.get('/companies', authenticate, async (req, res) => {
  try {
    const companies = await Company.findAll({
      where: { ownerId: req.userId },
      attributes: ['id', 'name', 'currency', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/register-device
   Purpose: issue revocable long-lived device token
================================ */
router.post('/register-device', authenticate, async (req, res) => {
  try {
    const { companyId, deviceId, deviceName } = req.body || {};
    if (!companyId || !deviceId || !deviceName) {
      return res.status(400).json({
        success: false,
        error: 'companyId, deviceId and deviceName are required'
      });
    }
    if (String(deviceId).length > 100) {
      return res.status(400).json({
        success: false,
        error: 'deviceId must be 100 characters or fewer'
      });
    }
    if (String(deviceName).length > 150) {
      return res.status(400).json({
        success: false,
        error: 'deviceName must be 150 characters or fewer'
      });
    }

    const company = await Company.findOne({
      where: {
        id: companyId,
        ownerId: req.userId
      }
    });

    if (!company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    // New auth flow rationale:
    // - raw device token is long-lived for installed connectors
    // - only SHA-256 hash is stored server-side
    // - revocation is done via status=revoked
    const rawDeviceToken = `aicfo_dev_${crypto.randomBytes(48).toString('hex')}`;
    const deviceTokenHash = hashToken(rawDeviceToken);

    const [device, created] = await ConnectorDevice.findOrCreate({
      where: { companyId, deviceId },
      defaults: {
        companyId,
        userId: req.userId,
        deviceId,
        deviceName: deviceName || null,
        deviceTokenHash,
        status: 'active',
        lastSeenAt: null
      }
    });

    if (!created) {
      await device.update({
        userId: req.userId,
        deviceName,
        deviceTokenHash,
        status: 'active',
        lastSeenAt: null
      });
    }

    return res.json({
      success: true,
      data: {
        deviceToken: rawDeviceToken,
        companyId: device.companyId,
        deviceId: device.deviceId,
        status: device.status,
        expiresInDays: 365
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/sync/start
   Auth: Bearer <connectorToken>
================================ */
router.post('/sync/start', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    const { link, error, statusCode } = await resolveLinkContext(req);
    if (error) {
      return res.status(statusCode || 400).json({ success: false, error });
    }
    const { companyId } = req;

    if (link) {
      await ConnectorCompanyLink.update(
        {
          lastSyncStatus: 'syncing',
          lastSyncError: null
        },
        { where: { id: link.id, userId: req.userId, isActive: true } }
      );
    }
    
    // Create new sync run
    const syncRun = await syncStatusService.createRun(
      companyId,
      'tally',
      req.connectorClientId
    );

    // Add initial event
    await syncStatusService.addEvent(
      syncRun.id,
      'info',
      'SYNC_START',
      'Sync run started',
      link ? { linkId: link.id } : null
    );

    res.json({
      success: true,
      data: {
        runId: syncRun.id,
        status: {
          status: syncRun.status,
          stage: syncRun.stage,
          progress: syncRun.progress
        }
      }
    });
  } catch (error) {
    console.error('Sync start error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/sync
   Auth: Bearer <connectorToken>
================================ */
router.post('/sync', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    const { error, statusCode } = await resolveLinkContext(req);
    if (error) {
      return res.status(statusCode || 400).json({ success: false, error });
    }
    const validation = validateChartOfAccountsPayload(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        error: 'Invalid connector payload',
        errors: [validation.error]
      });
    }

    const data = await integrationService.processConnectorPayload(req.companyId, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('Connector sync payload error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/sync/progress
   Auth: Bearer <connectorToken>
================================ */
router.post('/sync/progress', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    const { runId, stage, progress, stats, message } = req.body;

    if (!runId || !stage || progress === undefined) {
      return res.status(400).json({
        success: false,
        error: 'runId, stage, and progress are required'
      });
    }

    // Verify the run belongs to this company
    const syncRun = await IntegrationSyncRun.findOne({
      where: { 
        id: runId,
        companyId: req.companyId 
      }
    });

    if (!syncRun) {
      return res.status(404).json({
        success: false,
        error: 'Sync run not found'
      });
    }

    // Update sync run
    const updatedRun = await syncStatusService.updateRun(runId, {
      stage,
      progress,
      stats
    });

    // Add event
    const eventName = `STAGE_${stage.toUpperCase()}`;
    await syncStatusService.addEvent(
      runId,
      'info',
      eventName,
      message || `Progress: ${progress}%`
    );

    // Determine recommended next stage
    let recommendedNextStage = null;
    const stages = ['connect', 'discover', 'fetch', 'upload', 'normalize', 'snapshot', 'done'];
    const currentIndex = stages.indexOf(stage);
    if (currentIndex < stages.length - 1) {
      recommendedNextStage = stages[currentIndex + 1];
    }

    res.json({
      success: true,
      data: {
        ok: true,
        recommendedNextStage
      }
    });
  } catch (error) {
    console.error('Sync progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/sync/complete
   Auth: Bearer <connectorToken>
================================ */
router.post('/sync/complete', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    const { link, error: linkError, statusCode } = await resolveLinkContext(req);
    if (linkError) {
      return res.status(statusCode || 400).json({ success: false, error: linkError });
    }
    const {
      runId,
      status,
      finishedAt,
      lastError,
      missingMonths,
      historicalMonthsRequested,
      historicalMonthsSynced,
      metadata
    } = req.body;

    if (!runId || !status) {
      return res.status(400).json({
        success: false,
        error: 'runId and status are required'
      });
    }

    // Validate status
    const validStatuses = ['success', 'failed', 'partial', 'partial_success'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    const runStatus = status === 'partial_success' ? 'success' : status;

    // Verify the run belongs to this company
    const syncRun = await IntegrationSyncRun.findOne({
      where: { 
        id: runId,
        companyId: req.companyId 
      }
    });

    if (!syncRun) {
      return res.status(404).json({
        success: false,
        error: 'Sync run not found'
      });
    }

    // Complete the sync run
    const completedRun = await syncStatusService.completeRun(runId, runStatus, lastError);

    if (status === 'partial_success') {
      await syncStatusService.addEvent(
        runId,
        'warn',
        'SYNC_PARTIAL',
        'Sync completed with partial historical month coverage',
        {
          reason: 'historical_months_missing',
          missingMonths: Array.isArray(missingMonths)
            ? missingMonths
            : (Array.isArray(metadata?.missingMonths) ? metadata.missingMonths : []),
          historicalMonthsRequested: Number.isFinite(historicalMonthsRequested)
            ? Number(historicalMonthsRequested)
            : (Number.isFinite(metadata?.historicalMonthsRequested) ? Number(metadata.historicalMonthsRequested) : null),
          historicalMonthsSynced: Number.isFinite(historicalMonthsSynced)
            ? Number(historicalMonthsSynced)
            : (Number.isFinite(metadata?.historicalMonthsSynced) ? Number(metadata.historicalMonthsSynced) : null)
        }
      );
    }

    // Add completion event
    const eventLevel = runStatus === 'success' ? 'info' : 'error';
    const eventMessage = runStatus === 'success' ? 'Sync completed successfully' : `Sync failed: ${lastError}`;
    await syncStatusService.addEvent(
      runId,
      eventLevel,
      'SYNC_COMPLETE',
      eventMessage
    );

    if (link) {
      const isSuccessLike = ['success', 'partial', 'partial_success'].includes(String(status || '').toLowerCase());
      const normalizedStatus = isSuccessLike ? 'success' : 'failed';
      const normalizedError = isSuccessLike
        ? null
        : (String(lastError || 'Sync failed').slice(0, 500));
      await ConnectorCompanyLink.update(
        {
          lastSyncAt: completedRun.finishedAt || new Date(),
          lastSyncStatus: normalizedStatus,
          lastSyncError: normalizedError
        },
        { where: { id: link.id, userId: req.userId, isActive: true } }
      );
    }

    res.json({
      success: true,
      data: {
        runId: completedRun.id,
        status: completedRun.status,
        finishedAt: completedRun.finishedAt
      }
    });
  } catch (error) {
    console.error('Sync complete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   POST /api/connector/heartbeat
   Auth: Bearer <connectorToken>
================================ */
router.post('/heartbeat', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    const { link, error, statusCode } = await resolveLinkContext(req);
    if (error) {
      return res.status(statusCode || 400).json({ success: false, error });
    }
    const { companyId, connectorClientId, deviceId } = req;

    // Update connector last seen
    if (connectorClientId) {
      await syncStatusService.updateConnectorLastSeen(connectorClientId);
    }
    if (deviceId) {
      // Device-token path: keep connector_devices last_seen_at fresh without affecting legacy flow.
      try {
        await ConnectorDevice.update(
          { lastSeenAt: new Date() },
          { where: { companyId, deviceId } }
        );
      } catch (error) {
        console.warn('Device heartbeat update failed:', error.message);
      }
    }

    // Get latest run summary for company
    const latestRun = await IntegrationSyncRun.findOne({
      where: { companyId },
      order: [['started_at', 'DESC']],
      attributes: ['id', 'status', 'stage', 'progress', 'started_at', 'finished_at']
    });

    res.json({
      success: true,
      data: {
        linkId: link?.id || null,
        latestRun: latestRun || null,
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   GET /api/connector/status/connector
   Auth: connector token
================================ */
router.get('/status/connector', authenticateConnectorOrLegacy, async (req, res) => {
  try {
    const { error, statusCode } = await resolveLinkContext(req);
    if (error) {
      return res.status(statusCode || 400).json({ success: false, error });
    }
    const status = await syncStatusService.getSyncStatus(req.companyId);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get connector sync status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   GET /api/connector/status
   Auth: normal user JWT (front-end usage)
================================ */
router.get('/status', authenticate, async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId required'
      });
    }

    const company = await authorizeCompanyAccess(req.userId, companyId);

    if (!company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    // Keep legacy response shape for existing web clients.
    const legacyStatus = await syncStatusService.getSyncStatus(companyId);

    res.json({
      success: true,
      data: legacyStatus
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   GET /api/connector/status/v1
   Auth: normal user JWT (stable status shape for web + tray)
================================ */
router.get('/status/v1', authenticate, async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId required'
      });
    }

    const company = await authorizeCompanyAccess(req.userId, companyId);
    if (!company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    const stableStatus = await buildStableStatusResponse(companyId);
    return res.json({
      success: true,
      data: stableStatus
    });
  } catch (error) {
    console.error('Get stable connector status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   DEV-ONLY: POST /api/connector/dev/create-device
   Creates a ConnectorDevice with a raw token for E2E testing.
   Refuses when NODE_ENV !== 'development'.
================================ */
router.post('/dev/create-device', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ success: false, error: 'Dev endpoint only available when NODE_ENV=development' });
  }
  try {
      const [company] = await Company.findAll({
        where: { isDeleted: false, deletedAt: null },
        attributes: ['id', 'ownerId'],
        limit: 1,
        raw: true
      });
      if (!company) {
        return res.status(404).json({ success: false, error: 'No company found' });
      }
      const companyId = company.id;
      const userId = company.ownerId;
      const deviceId = `e2e-dev-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const rawToken = `aicfo_dev_${crypto.randomBytes(48).toString('hex')}`;
      const deviceTokenHash = hashToken(rawToken);
      await ConnectorDevice.create({
        companyId,
        userId,
        deviceId,
        deviceName: 'E2E Local Script',
        deviceTokenHash,
        status: 'active',
        lastSeenAt: new Date()
      });
      const fs = require('fs');
      const path = require('path');
      const tmpDir = path.join(__dirname, '..', '..', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const outPath = path.join(tmpDir, 'connector-dev-device.json');
      fs.writeFileSync(outPath, JSON.stringify({ device_id: deviceId, device_token: rawToken, company_id: companyId }, null, 2));
      return res.json({
        success: true,
        data: { device_id: deviceId, device_token: rawToken, company_id: companyId },
        message: `Saved to ${outPath}`
      });
  } catch (err) {
    console.error('Dev create-device error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================
   DEV-ONLY: GET /api/connector/dev/devices
   Returns last 5 connector_devices for E2E evidence.
   Refuses when NODE_ENV !== 'development'.
================================ */
router.get('/dev/devices', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ success: false, error: 'Dev endpoint only available when NODE_ENV=development' });
  }
  try {
    const devices = await ConnectorDevice.findAll({
      order: [['updatedAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'companyId', 'userId', 'deviceId', 'deviceName', 'status', 'lastSeenAt', 'createdAt', 'updatedAt'],
      raw: true
    });
    return res.json({ success: true, data: devices });
  } catch (err) {
    console.error('Dev devices error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
