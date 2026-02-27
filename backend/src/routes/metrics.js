'use strict';

const express = require('express');
const router = express.Router();
const { formatPrometheus } = require('../middleware/metricsCollector');
const { getErrorSpikeStats } = require('../middleware/errorSpikeMonitor');

router.get('/', async (req, res) => {
  try {
    const extra = {};

    extra.api_5xx_rolling_count = getErrorSpikeStats().count;

    try {
      const { getFailureCountSince } = require('../services/jobFailureService');
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      extra.queue_failures_last_hour = await getFailureCountSince(oneHourAgo);

      const { JobFailure } = require('../models');
      extra.dlq_count = await JobFailure.count({ where: { resolvedAt: null } });
    } catch (_) {
      extra.queue_failures_last_hour = 0;
      extra.dlq_count = 0;
    }

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(formatPrometheus(extra));
  } catch (err) {
    res.status(500).send('# metrics error\n');
  }
});

module.exports = router;
