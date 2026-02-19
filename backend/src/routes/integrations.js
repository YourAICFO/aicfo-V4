const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { integrationService } = require('../services');
const { logger } = require('../utils/logger');

// GET /api/integrations
router.get('/', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const integrations = await integrationService.getIntegrations(req.companyId);
    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    logger.error({ err: error }, 'Get integrations error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/tally
router.post('/tally', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const integration = await integrationService.connectTally(req.companyId, req.body, req.userId);
    res.status(201).json({
      success: true,
      message: 'Tally connected successfully',
      data: integration
    });
  } catch (error) {
    logger.error({ err: error }, 'Connect Tally error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/zoho
router.post('/zoho', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const integration = await integrationService.connectZoho(req.companyId, req.body, req.userId);
    res.status(201).json({
      success: true,
      message: 'Zoho Books connected successfully',
      data: integration
    });
  } catch (error) {
    logger.error({ err: error }, 'Connect Zoho error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/quickbooks
router.post('/quickbooks', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const integration = await integrationService.connectQuickBooks(req.companyId, req.body, req.userId);
    res.status(201).json({
      success: true,
      message: 'QuickBooks connected successfully',
      data: integration
    });
  } catch (error) {
    logger.error({ err: error }, 'Connect QuickBooks error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/:id/disconnect
router.post('/:id/disconnect', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const result = await integrationService.disconnectIntegration(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error({ err: error }, 'Disconnect integration error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/:id/sync
router.post('/:id/sync', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const result = await integrationService.syncIntegration(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message,
      data: {
        transactionsSynced: result.transactionsSynced
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Sync integration error');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
