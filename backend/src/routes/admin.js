const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { adminUsageService } = require('../services');
const { CFOMetric } = require('../models');
const { enqueueJob } = require('../worker/queue');
const { logger, logError } = require('../utils/logger');
const { backfillCompany, getBackfillStatus } = require('../services/adminBackfillService');
const { getCoverage, createRule } = require('../services/sourceNormalizationService');
const { runChecks } = require('../services/dataConsistencyService');

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

router.post('/backfill/company', requireAdminApiKey, async (req, res) => {
  try {
    const companyId = req.body?.companyId;
    const monthsBack = req.body?.monthsBack ?? 18;
    const markClosedThrough = req.body?.markClosedThrough ?? null;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }
    if (markClosedThrough && !/^\d{4}-\d{2}$/.test(markClosedThrough)) {
      return res.status(400).json({ success: false, error: 'markClosedThrough must be YYYY-MM' });
    }
    const data = await backfillCompany({
      companyId,
      monthsBack,
      markClosedThrough,
      runId: req.run_id || null
    });
    return res.json({ success: true, data });
  } catch (error) {
    logger.error({ event: 'admin_backfill_failed', error: error.message }, 'Admin company backfill failed');
    await logError({ event: 'admin_backfill_failed', service: 'ai-cfo-api', run_id: req.run_id || null }, 'Admin company backfill failed', error);
    return res.status(500).json({ success: false, error: 'Backfill failed' });
  }
});

router.get('/backfill/status', requireAdminApiKey, async (req, res) => {
  try {
    const companyId = req.query?.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }
    const data = await getBackfillStatus(companyId);
    return res.json({ success: true, data });
  } catch (error) {
    logger.error({ event: 'admin_backfill_status_failed', error: error.message }, 'Admin backfill status failed');
    await logError({ event: 'admin_backfill_status_failed', service: 'ai-cfo-api', run_id: req.run_id || null }, 'Admin backfill status failed', error);
    return res.status(500).json({ success: false, error: 'Backfill status failed' });
  }
});

router.get('/mapping/coverage/:companyId', requireAdminApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;
    const data = await getCoverage(companyId);
    return res.json({ success: true, data });
  } catch (error) {
    logger.error({ event: 'admin_mapping_coverage_failed', error: error.message }, 'Admin mapping coverage failed');
    await logError({ event: 'admin_mapping_coverage_failed', service: 'ai-cfo-api', run_id: req.run_id || null }, 'Admin mapping coverage failed', error);
    return res.status(500).json({ success: false, error: 'Mapping coverage failed' });
  }
});

router.post('/mapping/rule', requireAdminApiKey, async (req, res) => {
  try {
    const { sourceSystem, matchField, matchValue, normalizedType, normalizedBucket, priority, isActive } = req.body || {};
    if (!sourceSystem || !matchField || !matchValue || !normalizedType || !normalizedBucket) {
      return res.status(400).json({
        success: false,
        error: 'sourceSystem, matchField, matchValue, normalizedType and normalizedBucket are required'
      });
    }
    const data = await createRule({
      sourceSystem,
      matchField,
      matchValue,
      normalizedType,
      normalizedBucket,
      priority,
      isActive
    });
    return res.json({ success: true, data });
  } catch (error) {
    logger.error({ event: 'admin_mapping_rule_create_failed', error: error.message }, 'Admin mapping rule create failed');
    await logError({ event: 'admin_mapping_rule_create_failed', service: 'ai-cfo-api', run_id: req.run_id || null }, 'Admin mapping rule create failed', error);
    return res.status(500).json({ success: false, error: 'Mapping rule creation failed' });
  }
});

// GET /api/admin/data-consistency?companyId=...&month=YYYY-MM&amountTol=1&pctTol=0.01
router.get('/data-consistency', authenticate, requireAdmin, async (req, res) => {
  try {
    const companyId = req.query?.companyId;
    const month = req.query?.month;
    const amountTol = req.query?.amountTol != null ? Number(req.query.amountTol) : undefined;
    const pctTol = req.query?.pctTol != null ? Number(req.query.pctTol) : undefined;
    if (!companyId || !month) {
      return res.status(400).json({ success: false, error: 'companyId and month (YYYY-MM) are required' });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month must be YYYY-MM' });
    }
    const tolerance = {};
    if (amountTol !== undefined && Number.isFinite(amountTol)) tolerance.amount = amountTol;
    if (pctTol !== undefined && Number.isFinite(pctTol)) tolerance.pct = pctTol;
    const result = await runChecks(companyId, month, tolerance);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ event: 'data_consistency_failed', error: error.message }, 'Data consistency check failed');
    return res.status(500).json({ success: false, error: error.message });
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
