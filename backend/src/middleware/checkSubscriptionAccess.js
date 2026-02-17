const { checkAccess } = require('../services/subscriptionService');

const checkSubscriptionAccess = async (req, res, next) => {
  try {
    const result = await checkAccess(req.companyId, req.userId);
    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        error: result.reason || 'Access denied'
      });
    }
    next();
  } catch (error) {
    console.error('Subscription access error:', error);
    res.status(500).json({
      success: false,
      error: 'Subscription access check failed'
    });
  }
};

module.exports = { checkSubscriptionAccess };
