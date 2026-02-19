const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ConnectorDevice } = require('../models');
const syncStatusService = require('../services/syncStatusService');
const { jwtSecret } = require('../config/auth');

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const verifyConnectorDeviceLoginToken = (token) =>
  jwt.verify(token, jwtSecret);

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
    req.userId = device.userId;
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
      req.userId = device.userId;
      req.deviceId = device.deviceId;
      req.connectorDeviceId = device.id;
      req.connectorClientId = null;
      await device.update({ lastSeenAt: new Date() });
      return next();
    }

    try {
      const payload = verifyConnectorDeviceLoginToken(token);
      if (payload?.type === 'connector_device_login' && payload?.userId) {
        req.userId = payload.userId;
        req.deviceId = payload.deviceId || null;
        req.deviceName = payload.deviceName || null;
        req.companyId = null;
        req.connectorClientId = null;
        req.connectorDeviceId = null;
        req.connectorAuthMode = 'device_login';
        return next();
      }
    } catch {
      // Try legacy connector token flow next.
    }

    if (process.env.CONNECTOR_ENABLE_LEGACY_TOKEN_FLOW === '0') {
      return res.status(401).json({
        success: false,
        error: 'Legacy connector token flow is disabled'
      });
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
    req.userId = null;
    req.deviceId = null;
    req.connectorDeviceId = null;
    req.connectorAuthMode = 'legacy_connector_token';
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
  hashToken,
  verifyConnectorDeviceLoginToken
};
