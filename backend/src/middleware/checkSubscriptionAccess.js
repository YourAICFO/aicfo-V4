const { checkAccess } = require('../services/subscriptionService');

const checkSubscriptionAccess = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || null;
    const result = await checkAccess(req.companyId, userId);
    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        error: result.reason || 'Access denied'
      });
    }
    next();
  } catch (error) {
    require('../utils/logger').logger.error({ err: error }, 'Subscription access error');
    res.status(500).json({
      success: false,
      error: 'Subscription access check failed'
    });
  }
};

module.exports = { checkSubscriptionAccess };
