const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

const router = express.Router();

// Connector download configuration
const CONNECTOR_CONFIG = {
  filename: 'AICFOConnectorSetup.msi',
  version: '1.0.0',
  supportedPlatforms: ['win32', 'win64'],
  filePath: path.join(__dirname, '../../downloads/AICFOConnectorSetup.msi'),
  downloadUrl: process.env.CONNECTOR_DOWNLOAD_URL || '/download/connector',
};

/**
 * GET /download/connector
 * Download the Windows Tally Connector installer (MSI)
 */
router.get('/connector', async (req, res) => {
  try {
    const redirectUrl = process.env.CONNECTOR_DOWNLOAD_URL;
    if (redirectUrl) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, redirectUrl);
    }

    await fs.access(CONNECTOR_CONFIG.filePath);
    const stats = await fs.stat(CONNECTOR_CONFIG.filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${CONNECTOR_CONFIG.filename}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('X-Connector-Version', CONNECTOR_CONFIG.version);
    res.setHeader('Access-Control-Expose-Headers', 'X-Connector-Version, Content-Disposition');

    res.sendFile(CONNECTOR_CONFIG.filePath, (err) => {
      if (err) {
        logger.error({ error: err }, 'Error sending connector file');
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to send connector file',
          });
        }
      } else {
        logger.info({ 
          userAgent: req.headers['user-agent'] || '', 
          ip: req.ip,
          timestamp: new Date().toISOString(),
          fileType: CONNECTOR_CONFIG.filename
        }, 'Connector downloaded successfully');
      }
    });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      logger.error({ error }, 'Connector installer not found');
      return res.status(404).json({
        success: false,
        error: 'Connector installer not available',
        message: 'Set CONNECTOR_DOWNLOAD_URL to a GitHub release asset URL, or upload backend/downloads/AICFOConnectorSetup.msi',
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
    
    // Get file info if it exists
    try {
      const stats = await fs.stat(CONNECTOR_CONFIG.filePath);
      fileSize = stats.size;
      lastUpdated = stats.mtime;
    } catch (error) {
      // File doesn't exist, keep null values
    }
    
    res.json({
      success: true,
      data: {
        filename: CONNECTOR_CONFIG.filename,
        version: CONNECTOR_CONFIG.version,
        supportedPlatforms: CONNECTOR_CONFIG.supportedPlatforms,
        systemRequirements: {
          os: 'Windows 7 or later',
          framework: '.NET Desktop Runtime 8.0 (included with installer)',
          tally: 'Tally ERP 9/Prime with Tally API enabled',
          ram: 'Minimum 2GB RAM',
          disk: '50MB free disk space',
        },
        downloadUrl: CONNECTOR_CONFIG.downloadUrl,
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
      const stats = await fs.stat(CONNECTOR_CONFIG.filePath);
      fileExists = true;
      fileSize = stats.size;
      lastModified = stats.mtime;
    } catch (error) {
      // File doesn't exist
    }

    res.json({
      success: true,
      data: {
        fileExists,
        fileSize,
        lastModified,
        version: CONNECTOR_CONFIG.version,
        filename: CONNECTOR_CONFIG.filename,
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
