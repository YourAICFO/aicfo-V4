const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { enqueueJob, queue } = require('../worker/queue');

// POST /api/jobs/insights
router.post('/insights', authenticate, requireCompany, async (req, res) => {
  try {
    const job = await enqueueJob('generateAIInsights', {
      userId: req.userId,
      companyId: req.companyId
    });
    res.json({ success: true, data: { jobId: job.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/jobs/reports
router.post('/reports', authenticate, requireCompany, async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body;
    const job = await enqueueJob('updateReports', {
      userId: req.userId,
      companyId: req.companyId,
      periodStart,
      periodEnd
    });
    res.json({ success: true, data: { jobId: job.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/jobs/batch-recalc
router.post('/batch-recalc', authenticate, requireCompany, async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body;
    const job = await enqueueJob('batchRecalc', {
      userId: req.userId,
      companyId: req.companyId,
      periodStart,
      periodEnd
    });
    res.json({ success: true, data: { jobId: job.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/jobs/notifications
router.post('/notifications', authenticate, requireCompany, async (req, res) => {
  try {
    const { title, message, type, metadata } = req.body;
    const job = await enqueueJob('sendNotifications', {
      userId: req.userId,
      companyId: req.companyId,
      title,
      message,
      type,
      metadata
    });
    res.json({ success: true, data: { jobId: job.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', authenticate, requireCompany, async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const state = await job.getState();
    res.json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        state,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
