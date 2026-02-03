const jwt = require('jsonwebtoken');
const { User, Company, Subscription } = require('../models');
const { jwtSecret } = require('../config/auth');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Invalid token format.' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated.' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error.' });
  }
};

const requireCompany = async (req, res, next) => {
  try {
    const companyId = req.headers['x-company-id'];
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required.' });
    }

    const company = await Company.findOne({
      where: { id: companyId, ownerId: req.userId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const subscription = await Subscription.findOne({
      where: { companyId: company.id }
    });

    req.company = company;
    req.subscription = subscription;
    req.companyId = company.id;
    next();
  } catch (error) {
    console.error('Company middleware error:', error);
    res.status(500).json({ error: 'Error loading company.' });
  }
};

const requirePaidPlan = async (req, res, next) => {
  try {
    if (!req.subscription) {
      return res.status(403).json({ error: 'Subscription required.' });
    }

    if (req.subscription.planType === 'FREE') {
      return res.status(403).json({ 
        error: 'This feature requires a paid plan.',
        upgradeRequired: true
      });
    }

    next();
  } catch (error) {
    console.error('Paid plan middleware error:', error);
    res.status(500).json({ error: 'Error checking subscription.' });
  }
};

module.exports = {
  authenticate,
  requireCompany,
  requirePaidPlan
};
