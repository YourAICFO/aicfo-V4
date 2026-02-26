const { IntegrationSyncRun, IntegrationSyncEvent, ConnectorClient, Company } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

class SyncStatusService {
  /**
   * Create a new sync run
   * @param {string} companyId - Company ID
   * @param {string} integrationType - Integration type (default: 'tally')
   * @param {string} connectorClientId - Optional connector client ID
   * @returns {Promise<IntegrationSyncRun>} Created sync run
   */
  async createRun(companyId, integrationType = 'tally', connectorClientId = null) {
    return await IntegrationSyncRun.create({
      companyId,
      integrationType,
      connectorClientId,
      status: 'running',
      stage: 'connect',
      progress: 0
    });
  }

  /**
   * Update sync run progress
   * @param {string} runId - Sync run ID
   * @param {Object} updates - Updates to apply
   * @param {string} updates.stage - New stage
   * @param {number} updates.progress - Progress (0-100)
   * @param {Object} updates.stats - Stats object
   * @returns {Promise<IntegrationSyncRun>} Updated sync run
   */
  async updateRun(runId, { stage, progress, stats }) {
    const updates = {};
    if (stage !== undefined) updates.stage = stage;
    if (progress !== undefined) updates.progress = progress;
    if (stats !== undefined) updates.stats = stats;

    const [updatedRows] = await IntegrationSyncRun.update(updates, {
      where: { id: runId }
    });

    if (updatedRows === 0) {
      throw new Error(`Sync run ${runId} not found`);
    }

    return await IntegrationSyncRun.findByPk(runId);
  }

  /**
   * Add sync event
   * @param {string} runId - Sync run ID
   * @param {string} level - Event level (info, warn, error)
   * @param {string} event - Event name
   * @param {string} message - Optional message
   * @param {Object} data - Optional data
   * @returns {Promise<IntegrationSyncEvent>} Created event
   */
  async addEvent(runId, level, event, message = null, data = {}) {
    return await IntegrationSyncEvent.create({
      runId,
      level,
      event,
      message,
      data
    });
  }

  /**
   * Complete sync run
   * @param {string} runId - Sync run ID
   * @param {string} status - Final status (success, failed, partial)
   * @param {string} lastError - Optional error message
   * @returns {Promise<IntegrationSyncRun>} Completed sync run
   */
  async completeRun(runId, status, lastError = null) {
    const updates = {
      status,
      finishedAt: new Date()
    };

    if (lastError) {
      updates.lastError = lastError;
      updates.lastErrorAt = new Date();
    }

    const [updatedRows] = await IntegrationSyncRun.update(updates, {
      where: { id: runId }
    });

    if (updatedRows === 0) {
      throw new Error(`Sync run ${runId} not found`);
    }

    return await IntegrationSyncRun.findByPk(runId);
  }

  /**
   * Get latest sync status for a company
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Sync status summary
   */
  async getSyncStatus(companyId) {
    const latestRun = await IntegrationSyncRun.findOne({
      where: { companyId },
      order: [['started_at', 'DESC']]
    });

    const connectorClient = await ConnectorClient.findOne({
      where: { companyId },
      order: [['last_seen_at', 'DESC NULLS LAST']]
    });

    if (!latestRun) {
      return {
        lastSyncAt: null,
        lastStatus: null,
        lastStage: null,
        lastProgress: null,
        lastError: null,
        connectorLastSeenAt: connectorClient?.lastSeenAt || null,
        estimatedReady: false,
        estimatedReadyReason: 'No sync runs found'
      };
    }

    // Calculate estimated readiness
    let estimatedReady = false;
    let estimatedReadyReason = '';

    if (latestRun.status === 'success') {
      // Check if we have snapshot data
      const { MonthlyTrialBalanceSummary } = require('../models');
      const snapshotCount = await MonthlyTrialBalanceSummary.count({
        where: { companyId }
      });

      if (snapshotCount > 0) {
        estimatedReady = true;
        estimatedReadyReason = 'Ready for analysis';
      } else {
        estimatedReadyReason = 'No snapshot data available';
      }
    } else if (latestRun.status === 'running') {
      estimatedReadyReason = 'Sync in progress';
    } else if (latestRun.status === 'failed') {
      estimatedReadyReason = `Last sync failed: ${latestRun.lastError || 'Unknown error'}`;
    } else if (latestRun.finishedAt) {
      // Check if sync is stale (over 24 hours)
      const hoursSinceSync = (new Date() - latestRun.finishedAt) / (1000 * 60 * 60);
      if (hoursSinceSync > 24) {
        estimatedReadyReason = 'Sync is stale (over 24 hours)';
      } else {
        estimatedReady = true;
        estimatedReadyReason = 'Ready for analysis';
      }
    }

    return {
      lastSyncAt: latestRun.startedAt,
      lastStatus: latestRun.status,
      lastStage: latestRun.stage,
      lastProgress: latestRun.progress,
      lastError: latestRun.lastError,
      connectorLastSeenAt: connectorClient?.lastSeenAt || null,
      estimatedReady,
      estimatedReadyReason
    };
  }

  /**
   * Get sync runs for a company
   * @param {string} companyId - Company ID
   * @param {number} limit - Limit results
   * @returns {Promise<IntegrationSyncRun[]>} Sync runs
   */
  async getSyncRuns(companyId, limit = 20) {
    return await IntegrationSyncRun.findAll({
      where: { companyId },
      order: [['started_at', 'DESC']],
      limit,
      include: [
        {
          model: ConnectorClient,
          as: 'connectorClient',
          attributes: ['deviceId', 'deviceName', 'os', 'appVersion']
        }
      ]
    });
  }

  /**
   * Get sync events for a run
   * @param {string} runId - Sync run ID
   * @param {number} limit - Limit results
   * @returns {Promise<IntegrationSyncEvent[]>} Sync events
   */
  async getSyncEvents(runId, limit = 200) {
    return await IntegrationSyncEvent.findAll({
      where: { runId },
      order: [['time', 'DESC']],
      limit
    });
  }

  /**
   * Upsert connector client (legacy). Identity and health reporting are ConnectorDevice-centric;
   * this is kept for backward compatibility with short-lived connector tokens.
   * @param {string} companyId - Company ID
   * @param {Object} clientInfo - Client information
   * @returns {Promise<ConnectorClient>} Upserted client
   */
  async upsertConnectorClient(companyId, { deviceId, deviceName, os, appVersion }) {
    const [client, created] = await ConnectorClient.findOrCreate({
      where: { companyId, deviceId },
      defaults: {
        companyId,
        deviceId,
        deviceName,
        os,
        appVersion,
        lastSeenAt: new Date()
      }
    });

    if (!created) {
      await client.update({
        deviceName,
        os,
        appVersion,
        lastSeenAt: new Date()
      });
    }

    return client;
  }

  /**
   * Update connector client last seen
   * @param {string} clientId - Connector client ID
   * @returns {Promise<ConnectorClient>} Updated client
   */
  async updateConnectorLastSeen(clientId) {
    const [updatedRows] = await ConnectorClient.update(
      { lastSeenAt: new Date() },
      { where: { id: clientId } }
    );

    if (updatedRows === 0) {
      throw new Error(`Connector client ${clientId} not found`);
    }

    return await ConnectorClient.findByPk(clientId);
  }

  /**
   * Generate connector token
   * @param {string} clientId - Connector client ID
   * @param {string} companyId - Company ID
   * @returns {string} JWT token
   */
  generateConnectorToken(clientId, companyId) {
    const payload = {
      clientId,
      companyId,
      type: 'connector'
    };

    return jwt.sign(payload, jwtSecret, {
      expiresIn: '15m'
    });
  }

  /**
   * Verify connector token
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  verifyConnectorToken(token) {
    try {
      return jwt.verify(token, jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired connector token');
    }
  }
}

module.exports = new SyncStatusService();