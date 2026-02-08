const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { aiService, adminUsageService } = require('../services');

// GET /api/ai/insights
router.get('/insights', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const insights = await aiService.getInsights(req.companyId);
    adminUsageService.logEvent(req.companyId, req.userId, 'ai_insights_open').catch(() => {});
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Get insights error:', error);
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
    adminUsageService.logEvent(req.companyId, req.userId, 'ai_chat').catch(() => {});
    adminUsageService.logAIQuestion(req.companyId, req.userId, message, Boolean(response?.matched)).catch(() => {});
    if (response?.questionCode) {
      adminUsageService.logEvent(req.companyId, req.userId, 'ai_question_mapped', {
        questionCode: response.questionCode
      }).catch(() => {});
    } else {
      adminUsageService.logEvent(req.companyId, req.userId, 'ai_question_unmapped').catch(() => {});
    }
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Chat error:', error);
    adminUsageService.logAIQuestion(req.companyId, req.userId, req.body?.message || '', false).catch(() => {});
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
