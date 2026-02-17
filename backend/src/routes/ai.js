const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { aiService, adminUsageService } = require('../services');
const { AIChatThread, AIChatMessage } = require('../models');

const buildThreadTitle = (text) => {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
};

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
    const { message, threadId } = req.body;
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    let thread = null;
    if (threadId) {
      thread = await AIChatThread.findOne({
        where: { id: threadId, userId: req.userId, companyId: req.companyId }
      });
      if (!thread) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }
    } else {
      thread = await AIChatThread.create({
        userId: req.userId,
        companyId: req.companyId,
        title: buildThreadTitle(message)
      });
    }

    const response = await aiService.chatWithCFO(req.companyId, message);

    await AIChatMessage.bulkCreate([
      {
        threadId: thread.id,
        role: 'user',
        content: String(message)
      },
      {
        threadId: thread.id,
        role: 'assistant',
        content: String(response?.message || '')
      }
    ]);
    await thread.update({
      updatedAt: new Date(),
      title: thread.title || buildThreadTitle(message)
    });

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
      data: {
        ...response,
        threadId: thread.id
      }
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

// GET /api/ai/threads
router.get('/threads', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const threads = await AIChatThread.findAll({
      where: { userId: req.userId, companyId: req.companyId },
      attributes: ['id', 'title', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 100
    });

    const data = await Promise.all(threads.map(async (thread) => {
      const lastMessage = await AIChatMessage.findOne({
        where: { threadId: thread.id },
        order: [['createdAt', 'DESC']],
        attributes: ['content']
      });
      const snippetRaw = String(lastMessage?.content || '').replace(/\s+/g, ' ').trim();
      const lastMessageSnippet = snippetRaw.length > 140 ? `${snippetRaw.slice(0, 137)}...` : snippetRaw;
      return {
        id: thread.id,
        title: thread.title || 'Untitled chat',
        updated_at: thread.updatedAt,
        last_message_snippet: lastMessageSnippet
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ai/threads
router.post('/threads', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const title = req.body?.title ? buildThreadTitle(req.body.title) : null;
    const thread = await AIChatThread.create({
      userId: req.userId,
      companyId: req.companyId,
      title
    });
    res.status(201).json({
      success: true,
      data: {
        id: thread.id,
        title: thread.title,
        updated_at: thread.updatedAt
      }
    });
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/ai/threads/:id
router.get('/threads/:id', authenticate, requireCompany, checkSubscriptionAccess, async (req, res) => {
  try {
    const thread = await AIChatThread.findOne({
      where: { id: req.params.id, userId: req.userId, companyId: req.companyId },
      attributes: ['id', 'title', 'createdAt', 'updatedAt']
    });

    if (!thread) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found'
      });
    }

    const messages = await AIChatMessage.findAll({
      where: { threadId: thread.id },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'role', 'content', 'createdAt']
    });

    res.json({
      success: true,
      data: {
        thread: {
          id: thread.id,
          title: thread.title || 'Untitled chat',
          created_at: thread.createdAt,
          updated_at: thread.updatedAt
        },
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          created_at: message.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get thread detail error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
