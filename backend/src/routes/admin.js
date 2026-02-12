const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { adminUsageService } = require('../services');
const { CFOMetric } = require('../models');
const { enqueueJob } = require('../worker/queue');
const { logger, logError } = require('../utils/logger');

const requireAdminApiKey = (req, res, next) => {
  const expected = process.env.ADMIN_API_KEY;
  const provided = req.headers['x-admin-api-key'] || req.headers['admin-api-key'] || req.headers['admin_api_key'];
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid admin API key' });
  }
  next();
};

router.get('/usage/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getUsageSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/ai/questions', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getAIQuestions();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/companies/activity', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await adminUsageService.getCompaniesActivity();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/queue/ping', requireAdminApiKey, async (req, res) => {
  try {
    const companyId = req.body?.companyId || null;
    const at = new Date().toISOString();
    const job = await enqueueJob('healthPing', { companyId, at });
    return res.json({ ok: true, jobId: job.id });
  } catch (error) {
    logger.error({ event: 'queue_ping_enqueue_failed', error: error.message }, 'Failed to enqueue healthPing');
    await logError({ event: 'queue_ping_enqueue_failed', service: 'ai-cfo-api' }, 'Failed to enqueue healthPing', error);
    return res.status(500).json({ success: false, error: 'Failed to enqueue ping job' });
  }
});

// GET /admin/cfo-metrics?companyId=...&timeScope=...&metricKey=...
router.get('/cfo-metrics', authenticate, requireAdmin, async (req, res) => {
  try {
    const { companyId, timeScope, metricKey } = req.query;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }
    const where = { companyId };
    if (timeScope) where.timeScope = timeScope;
    if (metricKey) where.metricKey = metricKey;
    const rows = await CFOMetric.findAll({
      where,
      order: [['updated_at', 'DESC']],
      raw: true
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
