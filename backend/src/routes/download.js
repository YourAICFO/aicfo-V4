const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

const router = express.Router();

// Connector download configuration
const CONNECTOR_CONFIG = {
  filename: 'AICFOConnectorSetup.exe',
  version: '1.0.0',
  supportedPlatforms: ['win32', 'win64'],
  filePath: path.join(__dirname, '../../downloads/AICFOConnectorSetup.exe'),
  downloadUrl: process.env.CONNECTOR_DOWNLOAD_URL || '/download/connector',
};

/**
 * GET /download/connector
 * Download the Windows Tally Connector installer as ZIP
 */
router.get('/connector', async (req, res) => {
  try {
    // Check if connector file exists
    try {
      await fs.access(CONNECTOR_CONFIG.filePath);
    } catch (error) {
      logger.error({ error }, 'Connector installer not found');
      return res.status(404).json({
        success: false,
        error: 'Connector installer not found',
        message: 'The connector installer is currently being prepared. Please try again in a few minutes.',
      });
    }

    // For Node.js connector, we need to create a ZIP package
    // Check if we have the Node.js connector distribution
    const nodejsConnectorPath = path.join(__dirname, '../../../nodejs-connector/dist');
    const nodejsZipPath = path.join(__dirname, '../../../nodejs-connector/dist/AICFOConnector.zip');
    
    let fileToSend = CONNECTOR_CONFIG.filePath;
    let filename = CONNECTOR_CONFIG.filename;
    let contentType = 'application/octet-stream';
    
    // If Node.js connector ZIP exists, prefer that
    try {
      await fs.access(nodejsZipPath);
      fileToSend = nodejsZipPath;
      filename = 'AICFOConnector.zip';
      contentType = 'application/zip';
      logger.info('Using Node.js connector ZIP distribution');
    } catch (nodejsError) {
      // Node.js connector ZIP doesn't exist, use existing C# executable
      logger.info('Using existing C# connector executable');
    }

    // Get file stats for content-length
    const stats = await fs.stat(fileToSend);
    
    // Set appropriate headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('X-Connector-Version', CONNECTOR_CONFIG.version);
    res.setHeader('Access-Control-Expose-Headers', 'X-Connector-Version, Content-Disposition');
    
    // Send the file
    res.sendFile(fileToSend, (err) => {
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
          fileType: filename
        }, 'Connector downloaded successfully');
      }
    });

  } catch (error) {
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
          framework: '.NET Framework 4.7.2 or later',
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
          'Connects directly to Tally API on localhost',
          'Secure HTTPS encrypted communication',
          'Automatic company detection',
          'Real-time sync status indicators',
          'One-click sync functionality',
          'System tray integration',
        ],
        installationSteps: [
          'Download the connector installer',
          'Run as Administrator',
          'Enter your AI CFO credentials',
          'Click "Connect to Tally"',
          'Start syncing your financial data',
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