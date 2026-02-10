const { Integration, Subscription, FinancialTransaction } = require('../models');
const { enqueueJob } = require('../worker/queue');
const { normalizeMonth } = require('../utils/monthKeyUtils');
const { normalizeCoaPayload } = require('./tallyCoaAdapter');

const enforceIntegrationLimit = async (companyId, subscription) => {
  if (!subscription) return;
  if (subscription.subscriptionStatus === 'trial') return;
  if (!Number.isFinite(subscription.maxIntegrations)) return;

  const integrationCount = await Integration.count({ where: { companyId } });
  if (integrationCount >= subscription.maxIntegrations) {
    throw new Error('Integration limit reached');
  }
};

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
  if (!subscription || subscription.subscriptionStatus === 'expired') {
    throw new Error('Your free trial has expired. Please upgrade.');
  }

  await enforceIntegrationLimit(companyId, subscription);

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
  if (!subscription || subscription.subscriptionStatus === 'expired') {
    throw new Error('Your free trial has expired. Please upgrade.');
  }

  await enforceIntegrationLimit(companyId, subscription);

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
  if (!subscription || subscription.subscriptionStatus === 'expired') {
    throw new Error('Your free trial has expired. Please upgrade.');
  }

  await enforceIntegrationLimit(companyId, subscription);

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

    let amendedMonthKey = null;
    for (const tx of mockTransactions) {
      const txMonth = normalizeMonth(tx.date);
      if (txMonth && (!amendedMonthKey || txMonth < amendedMonthKey)) {
        amendedMonthKey = txMonth;
      }
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

    const snapshotPayload = integration.config?.monthlySnapshot || null;
    const currentBalances = integration.config?.currentBalances || null;
    const rawCoa = integration.config?.tallyCoaRaw || integration.config?.coaRaw || integration.config?.tallyMaster || integration.config?.chartOfAccounts || null;
    const normalizedCoa = rawCoa ? normalizeCoaPayload(rawCoa, companyId) : null;
    const chartOfAccounts = normalizedCoa?.chartOfAccounts || integration.config?.chartOfAccounts || null;
    await enqueueJob('generateMonthlySnapshots', {
      companyId,
      amendedMonth: snapshotPayload?.month || amendedMonthKey,
      debtors: snapshotPayload?.debtors || null,
      creditors: snapshotPayload?.creditors || null,
      currentBalances,
      chartOfAccounts: chartOfAccounts ? { ...chartOfAccounts, asOfDate: normalizedCoa?.asOfDate } : null
    });

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
