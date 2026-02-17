const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { cfoQuestionService, adminUsageService } = require('../services');

// GET /api/cfo/questions
router.get('/questions', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const questions = await cfoQuestionService.listQuestions();
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('List CFO questions error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/cfo/questions/:code
router.get('/questions/:code', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const result = await cfoQuestionService.answerQuestion(req.companyId, req.params.code);
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'cfo_question',
      eventName: 'cfo_question',
      metadata: { questionKey: req.params.code }
    });
    const missingMetricKeys = result?.missing?.metrics || [];
    const missingMetrics = missingMetricKeys.length > 0;
    adminUsageService.logAIQuestion(req.companyId, req.userId, req.params.code, !missingMetrics, {
      detectedQuestionKey: result?.code || req.params.code,
      failureReason: missingMetrics ? 'MISSING_METRICS' : null,
      reason: missingMetrics ? 'MISSING_METRICS' : null,
      missingMetricKeys,
      metricsUsedJson: result?.metrics || {}
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Answer CFO question error:', error);
    adminUsageService.logAIQuestion(req.companyId, req.userId, req.params.code, false, {
      detectedQuestionKey: req.params.code,
      failureReason: error.message
    });
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
