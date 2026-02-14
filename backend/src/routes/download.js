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
 * Download the Windows Tally Connector installer
 */
router.get('/connector', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isWindows = /windows|win32|win64/i.test(userAgent);
    
    if (!isWindows) {
      return res.status(400).json({
        success: false,
        error: 'Connector is only available for Windows operating systems',
        message: 'The AI CFO Tally Connector is designed specifically for Windows systems running Tally ERP 9 or TallyPrime.',
        alternative: 'Please use a Windows computer to download and install the connector.'
      });
    }

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

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${CONNECTOR_CONFIG.filename}"`);
    res.setHeader('X-Connector-Version', CONNECTOR_CONFIG.version);
    
    // Send the file
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
          userAgent, 
          ip: req.ip,
          timestamp: new Date().toISOString() 
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
router.get('/info', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isWindows = /windows|win32|win64/i.test(userAgent);
  
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
      fileSize: null, // Will be populated when file exists
      lastUpdated: null, // Will be populated when file exists
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