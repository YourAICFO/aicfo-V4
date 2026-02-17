const { subscriptionService } = require('../services');

const getStatus = async (req, res) => {
  try {
    const status = await subscriptionService.getStatus(req.companyId, req.userId);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = { getStatus };
