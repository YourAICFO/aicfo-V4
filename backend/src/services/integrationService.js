const { Integration, Subscription, FinancialTransaction } = require('../models');

const getIntegrations = async (companyId) => {
  const integrations = await Integration.findAll({
    where: { companyId },
    order: [['created_at', 'DESC']]
  });

  return integrations;
};

const connectTally = async (companyId, config) => {
  // Check subscription
  const subscription = await Subscription.findOne({ where: { companyId } });

  if (!subscription || !subscription.features.tally) {
    throw new Error('Tally integration requires a paid plan');
  }

  // Check integration limit
  const integrationCount = await Integration.count({ where: { companyId } });
  if (integrationCount >= subscription.maxIntegrations) {
    throw new Error('Integration limit reached');
  }

  // Check if already connected
  const existing = await Integration.findOne({
    where: { companyId, type: 'TALLY' }
  });

  if (existing) {
    throw new Error('Tally is already connected');
  }

  const integration = await Integration.create({
    companyId,
    type: 'TALLY',
    status: 'CONNECTED',
    config: {
      serverUrl: config.serverUrl || 'http://localhost:9000',
      companyName: config.companyName,
      autoSync: config.autoSync || false
    },
    companyName: config.companyName
  });

  return integration;
};

const connectZoho = async (companyId, config) => {
  // Check subscription
  const subscription = await Subscription.findOne({ where: { companyId } });

  if (!subscription || !subscription.features.zoho) {
    throw new Error('Zoho Books integration requires a Professional plan');
  }

  // Check integration limit
  const integrationCount = await Integration.count({ where: { companyId } });
  if (integrationCount >= subscription.maxIntegrations) {
    throw new Error('Integration limit reached');
  }

  // Check if already connected
  const existing = await Integration.findOne({
    where: { companyId, type: 'ZOHO' }
  });

  if (existing) {
    throw new Error('Zoho Books is already connected');
  }

  const integration = await Integration.create({
    companyId,
    type: 'ZOHO',
    status: 'CONNECTED',
    config: {
      organizationId: config.organizationId,
      autoSync: config.autoSync !== false
    },
    credentials: {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      expiresAt: config.expiresAt
    },
    companyName: config.organizationName
  });

  return integration;
};

const connectQuickBooks = async (companyId, config) => {
  // Check subscription
  const subscription = await Subscription.findOne({ where: { companyId } });

  if (!subscription || !subscription.features.quickbooks) {
    throw new Error('QuickBooks integration requires a Professional plan');
  }

  // Check integration limit
  const integrationCount = await Integration.count({ where: { companyId } });
  if (integrationCount >= subscription.maxIntegrations) {
    throw new Error('Integration limit reached');
  }

  // Check if already connected
  const existing = await Integration.findOne({
    where: { companyId, type: 'QUICKBOOKS' }
  });

  if (existing) {
    throw new Error('QuickBooks is already connected');
  }

  const integration = await Integration.create({
    companyId,
    type: 'QUICKBOOKS',
    status: 'CONNECTED',
    config: {
      realmId: config.realmId,
      autoSync: config.autoSync !== false
    },
    credentials: {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      expiresAt: config.expiresAt
    },
    companyName: config.companyName
  });

  return integration;
};

const disconnectIntegration = async (integrationId, companyId) => {
  const integration = await Integration.findOne({
    where: { id: integrationId, companyId }
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  await integration.update({ status: 'DISCONNECTED' });
  return { message: 'Integration disconnected' };
};

const syncIntegration = async (integrationId, companyId) => {
  const integration = await Integration.findOne({
    where: { id: integrationId, companyId }
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  await integration.update({
    status: 'SYNCING',
    lastSyncStatus: 'IN_PROGRESS'
  });

  try {
    // Simulate sync process
    // In production, this would call the actual API
    const mockTransactions = generateMockTransactions(integration.type);

    for (const tx of mockTransactions) {
      await FinancialTransaction.findOrCreate({
        where: {
          companyId,
          externalId: tx.externalId
        },
        defaults: {
          companyId,
          ...tx,
          source: integration.type
        }
      });
    }

    await integration.update({
      status: 'CONNECTED',
      lastSyncedAt: new Date(),
      lastSyncStatus: 'SUCCESS'
    });

    return {
      message: 'Sync completed successfully',
      transactionsSynced: mockTransactions.length
    };
  } catch (error) {
    await integration.update({
      status: 'ERROR',
      lastSyncStatus: 'FAILED',
      lastSyncError: error.message
    });
    throw error;
  }
};

const generateMockTransactions = (type) => {
  const transactions = [];
  const categories = {
    REVENUE: ['Product Sales', 'Service Revenue', 'Consulting', 'Subscription'],
    EXPENSE: ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Software', 'Travel']
  };

  for (let i = 0; i < 10; i++) {
    const isRevenue = Math.random() > 0.5;
    const type_category = isRevenue ? 'REVENUE' : 'EXPENSE';
    const categoryList = categories[type_category];
    const category = categoryList[Math.floor(Math.random() * categoryList.length)];

    transactions.push({
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: type_category,
      category,
      amount: Math.round(Math.random() * 50000 + 1000),
      description: `${category} - ${type}`,
      externalId: `${type}-${Date.now()}-${i}`
    });
  }

  return transactions;
};

module.exports = {
  getIntegrations,
  connectTally,
  connectZoho,
  connectQuickBooks,
  disconnectIntegration,
  syncIntegration
};
