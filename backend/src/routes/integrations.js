const express = require('express');
const router = express.Router();
const { authenticate, requireCompany, requirePaidPlan } = require('../middleware/auth');
const { integrationService } = require('../services');

// GET /api/integrations
router.get('/', authenticate, requireCompany, requirePaidPlan, async (req, res) => {
  try {
    const integrations = await integrationService.getIntegrations(req.companyId);
    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/tally
router.post('/tally', authenticate, requireCompany, requirePaidPlan, async (req, res) => {
  try {
    const integration = await integrationService.connectTally(req.companyId, req.body);
    res.status(201).json({
      success: true,
      message: 'Tally connected successfully',
      data: integration
    });
  } catch (error) {
    console.error('Connect Tally error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/zoho
router.post('/zoho', authenticate, requireCompany, requirePaidPlan, async (req, res) => {
  try {
    const integration = await integrationService.connectZoho(req.companyId, req.body);
    res.status(201).json({
      success: true,
      message: 'Zoho Books connected successfully',
      data: integration
    });
  } catch (error) {
    console.error('Connect Zoho error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/quickbooks
router.post('/quickbooks', authenticate, requireCompany, requirePaidPlan, async (req, res) => {
  try {
    const integration = await integrationService.connectQuickBooks(req.companyId, req.body);
    res.status(201).json({
      success: true,
      message: 'QuickBooks connected successfully',
      data: integration
    });
  } catch (error) {
    console.error('Connect QuickBooks error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/:id/disconnect
router.post('/:id/disconnect', authenticate, requireCompany, requirePaidPlan, async (req, res) => {
  try {
    const result = await integrationService.disconnectIntegration(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Disconnect integration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/:id/sync
router.post('/:id/sync', authenticate, requireCompany, requirePaidPlan, async (req, res) => {
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
    console.error('Sync integration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
