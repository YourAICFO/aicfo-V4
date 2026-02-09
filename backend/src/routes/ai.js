const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { aiService, adminUsageService } = require('../services');

// GET /api/ai/insights
router.get('/insights', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const insights = await aiService.getInsights(req.companyId);
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'ai_insight',
      eventName: 'ai_insights'
    });
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Get insights error:', error);
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'system_warning',
      eventName: 'ai_insights_error',
      metadata: { reason: error.message }
    });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ai/insights/:id/read
router.post('/insights/:id/read', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const result = await aiService.markInsightRead(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Mark insight read error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ai/insights/:id/dismiss
router.post('/insights/:id/dismiss', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const result = await aiService.dismissInsight(req.params.id, req.companyId);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Dismiss insight error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ai/chat
router.post('/chat', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const response = await aiService.chatWithCFO(req.companyId, message);
    adminUsageService.logUsageEvent({
      companyId: req.companyId,
      userId: req.userId,
      eventType: 'ai_chat',
      eventName: 'ai_chat',
      metadata: {
        messageLength: message.length,
        usedRewrite: process.env.AI_REWRITE_ENABLED === 'true'
      }
    });
    const missingMetrics = typeof response?.message === 'string' && response.message.includes('Not enough data');
    const aiSuccess = Boolean(response?.matched) && !missingMetrics;
    adminUsageService.logAIQuestion(req.companyId, req.userId, message, aiSuccess, {
      detectedQuestionKey: response?.questionCode || null,
      failureReason: response?.matched ? (missingMetrics ? 'missing_metrics' : null) : 'unmatched_intent',
      metricsUsedJson: response?.metrics || {}
    });
    if (response?.questionCode) {
      adminUsageService.logUsageEvent({
        companyId: req.companyId,
        userId: req.userId,
        eventType: 'cfo_question',
        eventName: 'ai_chat_question',
        metadata: { questionKey: response.questionCode }
      });
    } else {
      adminUsageService.logUsageEvent({
        companyId: req.companyId,
        userId: req.userId,
        eventType: 'system_warning',
        eventName: 'ai_question_unmapped'
      });
    }
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Chat error:', error);
    adminUsageService.logAIQuestion(req.companyId, req.userId, req.body?.message || '', false, {
      failureReason: error.message
    });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
