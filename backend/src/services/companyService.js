const { Company, Subscription, Integration } = require('../models');
const { createTrialSubscription } = require('./subscriptionService');

const isAdminEmail = (email) => {
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes((email || '').toLowerCase());
};

const createCompany = async (userId, companyData) => {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 30);

  const company = await Company.create({
    ...companyData,
    ownerId: userId,
    trialStartDate: now,
    trialEndDate: trialEnd,
    subscriptionStatus: 'trial'
  });

  // Create trial subscription
  await createTrialSubscription(company.id);

  return company;
};

const getUserCompanies = async (userId, opts = {}, userEmail = null) => {
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
    order: [['created_at', 'DESC']]
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
