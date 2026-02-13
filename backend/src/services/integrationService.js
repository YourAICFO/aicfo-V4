const { Integration, Subscription, FinancialTransaction } = require('../models');
const { enqueueJob } = require('../worker/queue');
const { normalizeMonth } = require('../utils/monthKeyUtils');
const { normalizeCoaPayload } = require('./tallyCoaAdapter');
const { upsertSourceLedgersFromChartOfAccounts, upsertSourceLedgersFromTransactions } = require('./sourceNormalizationService');
const { TallyClient } = require('./tallyClient');
const { logger } = require('../utils/logger');

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

  // Update sync status to show progress
  await integration.update({
    status: 'SYNCING',
    lastSyncStatus: 'IN_PROGRESS'
  });

  try {
    let syncResult = {};
    
    if (integration.type === 'TALLY') {
      syncResult = await syncTallyIntegration(integration, companyId);
    } else {
      // For other integrations, use mock data for now
      syncResult = await syncMockIntegration(integration, companyId);
    }

    await integration.update({
      status: 'CONNECTED',
      lastSyncedAt: new Date(),
      lastSyncStatus: 'SUCCESS',
      lastSyncError: null
    });

    return {
      message: 'Sync completed successfully',
      ...syncResult
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

const syncTallyIntegration = async (integration, companyId) => {
  const serverUrl = integration.config?.serverUrl || 'http://localhost:9000';
  const companyName = integration.config?.companyName;
  
  if (!companyName) {
    throw new Error('Company name is required for Tally sync');
  }

  logger.info({ integrationId: integration.id, companyId, serverUrl, companyName }, 'Starting Tally sync');

  // Stage 1: Connect and fetch raw data
  const tallyClient = new TallyClient(serverUrl);
  
  // Test connection first
  const isConnected = await tallyClient.testConnection();
  if (!isConnected) {
    throw new Error('Cannot connect to Tally server. Please ensure Tally is running and the API is enabled.');
  }

  // Fetch data from Tally
  const [vouchers, ledgers, chartOfAccounts] = await Promise.all([
    tallyClient.getVouchers(companyName),
    tallyClient.getLedgers(companyName),
    tallyClient.getChartOfAccounts(companyName)
  ]);

  logger.info({ 
    integrationId: integration.id, 
    voucherCount: vouchers?.length || 0,
    ledgerCount: ledgers?.length || 0 
  }, 'Raw data fetched from Tally');

  // Stage 2: Persist raw data (source_* tables)
  let amendedMonthKey = null;
  let transactionCount = 0;

  if (vouchers && vouchers.length > 0) {
    for (const voucher of vouchers) {
      // Convert Tally voucher to our transaction format
      const transaction = convertTallyVoucherToTransaction(voucher, companyId, integration.type);
      if (transaction) {
        const txMonth = normalizeMonth(transaction.date);
        if (txMonth && (!amendedMonthKey || txMonth < amendedMonthKey)) {
          amendedMonthKey = txMonth;
        }
        
        await FinancialTransaction.findOrCreate({
          where: {
            companyId,
            externalId: transaction.externalId
          },
          defaults: transaction
        });
        transactionCount++;
      }
    }
    
    // Store source ledgers from transactions
    await upsertSourceLedgersFromTransactions(companyId, 'tally', vouchers);
  }

  // Stage 3: Normalize and map data
  const normalizedCoa = chartOfAccounts ? normalizeCoaPayload(chartOfAccounts, companyId) : null;
  
  if (ledgers && ledgers.length > 0) {
    await upsertSourceLedgersFromChartOfAccounts(companyId, 'tally', ledgers);
  }

  // Stage 4: Generate structured tables (monthly snapshots)
  await enqueueJob('generateMonthlySnapshots', {
    companyId,
    amendedMonth: amendedMonthKey,
    debtors: null, // Will be derived from ledgers
    creditors: null, // Will be derived from ledgers
    currentBalances: null, // Will be calculated
    chartOfAccounts: normalizedCoa
  });

  logger.info({ 
    integrationId: integration.id, 
    transactionCount,
    amendedMonthKey 
  }, 'Tally sync completed successfully');

  return {
    transactionsSynced: transactionCount,
    vouchersProcessed: vouchers?.length || 0,
    ledgersProcessed: ledgers?.length || 0,
    amendedMonthKey
  };
};

const convertTallyVoucherToTransaction = (voucher, companyId, sourceType) => {
  try {
    // Basic conversion - this should be enhanced based on actual Tally voucher structure
    const amount = Math.abs(parseFloat(voucher.amount || voucher.total || 0));
    if (!amount || amount === 0) return null;

    // Determine transaction type based on voucher
    const type = voucher.voucherType === 'Sales' ? 'REVENUE' : 
                 voucher.voucherType === 'Purchase' ? 'EXPENSE' : 
                 voucher.isReceipt ? 'REVENUE' : 'EXPENSE';

    return {
      companyId,
      date: voucher.date || voucher.voucherDate || new Date().toISOString().split('T')[0],
      type,
      category: voucher.ledgerName || voucher.partyName || voucher.voucherType || 'Unknown',
      amount: amount,
      description: voucher.narration || voucher.voucherType || 'Tally transaction',
      externalId: voucher.guid || voucher.voucherNumber || `${sourceType}-${Date.now()}`,
      source: sourceType
    };
  } catch (error) {
    logger.error({ error: error.message, voucher }, 'Failed to convert Tally voucher to transaction');
    return null;
  }
};

const syncMockIntegration = async (integration, companyId) => {
  // Fallback to mock data for non-Tally integrations
  logger.warn({ integrationId: integration.id, type: integration.type }, 'Using mock data for non-Tally integration');
  
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
  await upsertSourceLedgersFromTransactions(companyId, String(integration.type || '').toLowerCase(), mockTransactions);

  const snapshotPayload = integration.config?.monthlySnapshot || null;
  const currentBalances = integration.config?.currentBalances || null;
  const rawCoa = integration.config?.tallyCoaRaw || integration.config?.coaRaw || integration.config?.tallyMaster || integration.config?.chartOfAccounts || null;
  const normalizedCoa = rawCoa ? normalizeCoaPayload(rawCoa, companyId) : null;
  const chartOfAccounts = normalizedCoa?.chartOfAccounts || integration.config?.chartOfAccounts || null;
  if (chartOfAccounts) {
    await upsertSourceLedgersFromChartOfAccounts(companyId, String(integration.type || '').toLowerCase(), chartOfAccounts);
  }
  await enqueueJob('generateMonthlySnapshots', {
    companyId,
    amendedMonth: snapshotPayload?.month || amendedMonthKey,
    debtors: snapshotPayload?.debtors || null,
    creditors: snapshotPayload?.creditors || null,
    currentBalances,
    chartOfAccounts: chartOfAccounts ? { ...chartOfAccounts, asOfDate: normalizedCoa?.asOfDate } : null
  });

  return {
    transactionsSynced: mockTransactions.length,
    message: 'Mock sync completed'
  };
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
