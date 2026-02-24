const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { Company, ConnectorDevice } = require('../models');

const router = express.Router();

const CONNECTOR_FILE_PATH = path.join(__dirname, '../../downloads/AICFOConnectorSetup.msi');

/**
 * GET /api/admin/connector/download-info
 * Auth: required, admin. Returns connector download configuration (no secrets).
 */
router.get('/download-info', authenticate, requireAdmin, async (req, res) => {
  try {
    const connectorDownloadUrl = process.env.CONNECTOR_DOWNLOAD_URL
      ? String(process.env.CONNECTOR_DOWNLOAD_URL).trim()
      : null;
    let localFileExists = false;
    try {
      await fs.access(CONNECTOR_FILE_PATH);
      localFileExists = true;
    } catch {
      // file not present
    }
    return res.json({
      connectorDownloadUrlConfigured: !!connectorDownloadUrl,
      connectorDownloadUrl: connectorDownloadUrl || null,
      localFileExists,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/devices', authenticate, async (req, res) => {
  try {
    const { companyId } = req.query || {};
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required'
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

    const devices = await ConnectorDevice.findAll({
      where: { companyId },
      attributes: ['deviceId', 'deviceName', 'status', 'lastSeenAt', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Transitional admin endpoint for connector token lifecycle management.
// Uses normal user JWT and company ownership checks.
router.post('/revoke', authenticate, async (req, res) => {
  try {
    const { deviceId, companyId } = req.body || {};
    if (!deviceId || !companyId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId and companyId are required'
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

    const [updatedRows] = await ConnectorDevice.update({
      status: 'revoked'
    }, {
      where: {
        companyId,
        deviceId
      }
    });

    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    return res.json({
      success: true,
      data: {
        companyId,
        deviceId,
        status: 'revoked'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
