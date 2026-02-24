const { Company, Subscription, Integration, sequelize } = require('../models');
const { createTrialSubscription } = require('./subscriptionService');
const planService = require('./planService');
const { logger } = require('../utils/logger');

const ENFORCE_COMPANY_LIMITS = process.env.ENFORCE_COMPANY_LIMITS === 'true';

let loggedCompanyModelMapping = false;

const isAdminEmail = (email) => {
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes((email || '').toLowerCase());
};

const createCompany = async (userId, companyData) => {
  const { planKey, caps, companyCount } = await planService.getEffectivePlanForUser(userId);
  if (companyCount >= caps.companyLimit) {
    if (ENFORCE_COMPANY_LIMITS) {
      const err = new Error('Upgrade to add more companies.');
      err.code = 'PLAN_LIMIT_COMPANIES';
      err.statusCode = 403;
      throw err;
    }
    logger.warn(
      { userId, planKey, companyLimit: caps.companyLimit, companyCount },
      'Company limit exceeded but ENFORCE_COMPANY_LIMITS=false; allowing create'
    );
  }

  const company = await Company.create({
    ...companyData,
    ownerId: userId
    // Trial is user-level (UserBillingProfile); no per-company trial fields set here.
  });

  // Legacy: ensure a Subscription row exists for backward compatibility with ensureSubscription/checkAccess fallback.
  await createTrialSubscription(company.id);

  return company;
};

const getUserCompanies = async (userId, opts = {}, userEmail = null) => {
  if (process.env.NODE_ENV !== 'production' && !loggedCompanyModelMapping) {
    loggedCompanyModelMapping = true;
    require('../utils/logger').logger.debug({
      tableName: Company.getTableName(),
      createdAtField: Company.rawAttributes?.createdAt?.field,
      updatedAtField: Company.rawAttributes?.updatedAt?.field
    }, 'Company model mapping');
  }

  const includeDeleted = opts.includeDeleted === true && isAdminEmail(userEmail);
  const companies = await Company.findAll({
    where: {
      ownerId: userId,
      ...(includeDeleted ? {} : { isDeleted: false })
    },
    include: [{
      model: Subscription,
      as: 'subscription',
      attributes: ['planType', 'status', 'features']
    }],
    order: [[sequelize.col('Company.created_at'), 'DESC']]
  });

  return companies;
};

const getCompanyById = async (companyId, userId) => {
  const company = await Company.findOne({
    where: { id: companyId, ownerId: userId, isDeleted: false },
    include: [
      {
        model: Subscription,
        as: 'subscription'
      },
      {
        model: Integration,
        as: 'integrations'
      }
    ]
  });

  if (!company) {
    throw new Error('Company not found');
  }

  return company;
};

const updateCompany = async (companyId, userId, updateData) => {
  const company = await Company.findOne({
    where: { id: companyId, ownerId: userId, isDeleted: false }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const allowedUpdates = [
    'name', 'industry', 'currency', 'address', 'city',
    'state', 'country', 'pincode', 'gstNumber', 'panNumber'
  ];

  const updates = {};
  allowedUpdates.forEach(field => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  await company.update(updates);
  return company;
};

const deleteCompany = async (companyId, userId, userEmail = null) => {
  const canAdminDelete = isAdminEmail(userEmail);
  const company = await Company.findOne({
    where: canAdminDelete
      ? { id: companyId }
      : { id: companyId, ownerId: userId }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  if (company.isDeleted) {
    return { message: 'Company already archived' };
  }

  await company.update({
    isDeleted: true,
    deletedAt: new Date(),
    deletedByUserId: userId
  });

  return { message: 'Company archived successfully' };
};

module.exports = {
  createCompany,
  getUserCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany
};
