const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { checkSubscriptionAccess } = require('../middleware/checkSubscriptionAccess');
const { cfoQuestionService } = require('../services');

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
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Answer CFO question error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
