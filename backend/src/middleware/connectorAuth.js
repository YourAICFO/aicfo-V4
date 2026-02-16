const crypto = require('crypto');
const { ConnectorDevice } = require('../models');
const syncStatusService = require('../services/syncStatusService');

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const authenticateConnectorDevice = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const deviceTokenHash = hashToken(token);
    const device = await ConnectorDevice.findOne({
      where: {
        deviceTokenHash,
        status: 'active'
      }
    });

    if (!device) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or revoked device token'
      });
    }

    req.companyId = device.companyId;
    req.deviceId = device.deviceId;
    req.connectorDeviceId = device.id;
    req.connectorClientId = null;
    await device.update({ lastSeenAt: new Date() });
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message
    });
  }
};

// Transitional middleware:
// 1) Try long-lived device token first (new recommended flow).
// 2) Fall back to legacy short-lived connector token for backward compatibility.
const authenticateConnectorOrLegacy = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const deviceTokenHash = hashToken(token);
    const device = await ConnectorDevice.findOne({
      where: {
        deviceTokenHash,
        status: 'active'
      }
    });

    if (device) {
      req.companyId = device.companyId;
      req.deviceId = device.deviceId;
      req.connectorDeviceId = device.id;
      req.connectorClientId = null;
      await device.update({ lastSeenAt: new Date() });
      return next();
    }

    const payload = syncStatusService.verifyConnectorToken(token);
    if (payload.type !== 'connector') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    req.connectorClientId = payload.clientId;
    req.companyId = payload.companyId;
    req.deviceId = null;
    req.connectorDeviceId = null;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  authenticateConnectorDevice,
  authenticateConnectorOrLegacy,
  hashToken
};
