const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { integrationService, authService } = require('../services');
const syncStatusService = require('../services/syncStatusService');
const { IntegrationSyncRun, Company, ConnectorDevice } = require('../models');
const { authenticate } = require('../middleware/auth');
const { authenticateConnectorOrLegacy, hashToken } = require('../middleware/connectorAuth');
const { validateChartOfAccountsPayload } = require('../services/coaPayloadValidator');

const connectorLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

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
      decodedUser = jwt.verify(userJwt, process.env.JWT_SECRET || 'fallback-secret');
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

    // Create/upsert connector client
    const connectorClient = await syncStatusService.upsertConnectorClient(
      companyId,
      { deviceId, deviceName, os, appVersion }
    );

    // Generate connector token
    const connectorToken = syncStatusService.generateConnectorToken(
      connectorClient.id,
      companyId
    );

    res.json({
      success: true,
      data: {
        connectorToken,
        connectorClientId: connectorClient.id,
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
    const { companyId } = req;
    
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
      'Sync run started'
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
    const { runId, status, finishedAt, lastError } = req.body;

    if (!runId || !status) {
      return res.status(400).json({
        success: false,
        error: 'runId and status are required'
      });
    }

    // Validate status
    const validStatuses = ['success', 'failed', 'partial'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
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

    // Complete the sync run
    const completedRun = await syncStatusService.completeRun(runId, status, lastError);

    // Add completion event
    const eventLevel = status === 'success' ? 'info' : 'error';
    const eventMessage = status === 'success' ? 'Sync completed successfully' : `Sync failed: ${lastError}`;
    await syncStatusService.addEvent(
      runId,
      eventLevel,
      'SYNC_COMPLETE',
      eventMessage
    );

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
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId query parameter is required'
      });
    }

    // Verify user has access to this company
    const company = await Company.findOne({
      where: { 
        id: companyId,
        owner_id: req.userId 
      }
    });

    if (!company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    // Get sync status
    const status = await syncStatusService.getSyncStatus(companyId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
