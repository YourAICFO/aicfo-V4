const { Company, Subscription, FinancialTransaction, CashBalance, Integration, AIInsight } = require('../models');

const createCompany = async (userId, companyData) => {
  const company = await Company.create({
    ...companyData,
    ownerId: userId
  });

  // Create default FREE subscription
  await Subscription.create({
    companyId: company.id,
    planType: 'FREE',
    status: 'ACTIVE',
    maxTransactions: 100,
    maxIntegrations: 0,
    features: {
      manualEntry: true,
      aiInsights: false,
      aiChat: false,
      tally: false,
      zoho: false,
      quickbooks: false,
      alerts: false,
      exports: false
    }
  });

  return company;
};

const getUserCompanies = async (userId) => {
  const companies = await Company.findAll({
    where: { ownerId: userId },
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
    where: { id: companyId, ownerId: userId },
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
    where: { id: companyId, ownerId: userId }
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

const deleteCompany = async (companyId, userId) => {
  const company = await Company.findOne({
    where: { id: companyId, ownerId: userId }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  // Delete related data
  await FinancialTransaction.destroy({ where: { companyId } });
  await CashBalance.destroy({ where: { companyId } });
  await Integration.destroy({ where: { companyId } });
  await AIInsight.destroy({ where: { companyId } });
  await Subscription.destroy({ where: { companyId } });
  await company.destroy();

  return { message: 'Company deleted successfully' };
};

module.exports = {
  createCompany,
  getUserCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany
};
