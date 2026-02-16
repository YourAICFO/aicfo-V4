const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Company, ConnectorDevice } = require('../models');

const router = express.Router();

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
