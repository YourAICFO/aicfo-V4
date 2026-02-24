const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

const router = express.Router();

// Connector download: production uses CONNECTOR_DOWNLOAD_URL (302 redirect); dev can serve local file.
const CONNECTOR_FILENAME = 'AICFOConnectorSetup.msi';
const CONNECTOR_FILE_PATH = path.join(__dirname, '../../downloads', CONNECTOR_FILENAME);
const isProduction = process.env.NODE_ENV === 'production';

/**
 * GET /download/connector
 * - If CONNECTOR_DOWNLOAD_URL is set: respond with HTTP 302 redirect to that URL.
 * - If not set in production: return 500 with JSON { success: false, error: "CONNECTOR_DOWNLOAD_URL not configured" }.
 * - If not set in dev and backend/downloads/AICFOConnectorSetup.msi exists: serve file (application/octet-stream, attachment).
 * - Otherwise: 404 with helpful message.
 */
router.get('/connector', async (req, res) => {
  try {
    const redirectUrl = process.env.CONNECTOR_DOWNLOAD_URL
      ? String(process.env.CONNECTOR_DOWNLOAD_URL).trim()
      : null;

    if (redirectUrl) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, redirectUrl);
    }

    if (isProduction) {
      return res.status(500).json({
        success: false,
        error: 'CONNECTOR_DOWNLOAD_URL not configured',
      });
    }

    await fs.access(CONNECTOR_FILE_PATH);
    const stats = await fs.stat(CONNECTOR_FILE_PATH);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${CONNECTOR_FILENAME}"`);
    res.setHeader('Content-Length', stats.size);

    res.sendFile(CONNECTOR_FILE_PATH, (err) => {
      if (err) {
        logger.error({ error: err }, 'Error sending connector file');
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to send connector file',
          });
        }
      } else {
        logger.info(
          {
            userAgent: req.headers['user-agent'] || '',
            ip: req.ip,
            timestamp: new Date().toISOString(),
            fileType: CONNECTOR_FILENAME,
          },
          'Connector downloaded successfully (local file)'
        );
      }
    });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      logger.warn({ path: CONNECTOR_FILE_PATH }, 'Connector installer not found (local dev fallback)');
      return res.status(404).json({
        success: false,
        error: 'Connector installer not available',
        message: 'Set CONNECTOR_DOWNLOAD_URL, or place MSI at backend/downloads/AICFOConnectorSetup.msi (see backend/downloads/README.md).',
      });
    }

    logger.error({ error }, 'Error handling connector download');
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error while processing download',
      });
    }
  }
});

// For /download/info and /download/check: resolved download URL (redirect URL when set, else path)
const getEffectiveDownloadUrl = () =>
  process.env.CONNECTOR_DOWNLOAD_URL
    ? String(process.env.CONNECTOR_DOWNLOAD_URL).trim()
    : '/download/connector';

/**
 * GET /download/info
 * Get connector download information and system requirements
 */
router.get('/info', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isWindows = /windows|win32|win64/i.test(userAgent);

    let fileSize = null;
    let lastUpdated = null;

    try {
      const stats = await fs.stat(CONNECTOR_FILE_PATH);
      fileSize = stats.size;
      lastUpdated = stats.mtime;
    } catch {
      // File doesn't exist, keep null values
    }

    res.json({
      success: true,
      data: {
        filename: CONNECTOR_FILENAME,
        version: '1.0.0',
        supportedPlatforms: ['win32', 'win64'],
        systemRequirements: {
          os: 'Windows 7 or later',
          framework: '.NET Desktop Runtime 8.0 (included with installer)',
          tally: 'Tally ERP 9/Prime with Tally API enabled',
          ram: 'Minimum 2GB RAM',
          disk: '50MB free disk space',
        },
        downloadUrl: getEffectiveDownloadUrl(),
        isWindows,
        canDownload: isWindows,
        fileSize,
        lastUpdated,
        features: [
          'Runs as Windows Service (auto-start)',
          'Secure token storage via Windows Credential Manager',
          'Connects directly to Tally XML over localhost HTTP port',
          'Connector heartbeat + scheduled sync',
          'One-click sync-now from tray support app',
          'Logs under ProgramData for supportability',
        ],
        installationSteps: [
          'Download and run AICFOConnectorSetup.msi as Administrator',
          'Open tray app and configure API URL, Company ID, Connector Token',
          'Ensure Tally is running and XML port is enabled',
          'Service starts automatically and begins heartbeat',
          'Use tray action "Sync Now" for immediate sync test',
        ],
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error getting download info');
    res.status(500).json({
      success: false,
      error: 'Failed to get download information',
    });
  }
});

/**
 * GET /download/check
 * Check if connector file exists and get file info
 */
router.get('/check', async (req, res) => {
  try {
    let fileExists = false;
    let fileSize = null;
    let lastModified = null;

    try {
      const stats = await fs.stat(CONNECTOR_FILE_PATH);
      fileExists = true;
      fileSize = stats.size;
      lastModified = stats.mtime;
    } catch {
      // File doesn't exist
    }

    res.json({
      success: true,
      data: {
        fileExists,
        fileSize,
        lastModified,
        version: '1.0.0',
        filename: CONNECTOR_FILENAME,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error checking connector file');
    res.status(500).json({
      success: false,
      error: 'Failed to check connector file',
    });
  }
});

module.exports = router;
