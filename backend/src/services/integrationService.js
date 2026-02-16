const {
  Integration,
  Subscription,
  FinancialTransaction,
  LedgerMonthlyBalance,
  PartyBalanceLatest,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CFOMetric,
  IntegrationSyncRun,
  IntegrationSyncEvent
} = require('../models');
const { enqueueJob } = require('../worker/queue');
const { normalizeMonth } = require('../utils/monthKeyUtils');
const { normalizeCoaPayload } = require('./tallyCoaAdapter');
const { upsertSourceLedgersFromChartOfAccounts, upsertSourceLedgersFromTransactions } = require('./sourceNormalizationService');
const { mapLedgersToCFOTotals } = require('./cfoAccountMappingService');
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
  
  const chartOfAccountsForUpsert = normalizedCoa?.chartOfAccounts || (ledgers && ledgers.length > 0 ? { groups: [], ledgers } : null);
  if (chartOfAccountsForUpsert) {
    await upsertSourceLedgersFromChartOfAccounts(companyId, 'tally', chartOfAccountsForUpsert);
  } else {
    logger.warn({ integrationId: integration.id, companyId }, 'Skipping source ledger upsert: no chartOfAccounts.ledgers provided');
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

const toNumber = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const persistOptionalConnectorBlocks = async (companyId, payload, monthKey) => {
  const { partyBalances, loans, interestSummary, metadata } = payload || {};

  if (partyBalances && (Array.isArray(partyBalances.debtors) || Array.isArray(partyBalances.creditors))) {
    try {
      const asOfDate = partyBalances.asOfDate || new Date().toISOString().split('T')[0];
      const rows = [];
      for (const item of (partyBalances.debtors || [])) {
        const name = String(item?.name || '').trim();
        if (!name) continue;
        rows.push({
          companyId,
          asOfDate,
          partyType: 'debtor',
          partyName: name,
          balance: toNumber(item?.amount),
          source: 'connector'
        });
      }
      for (const item of (partyBalances.creditors || [])) {
        const name = String(item?.name || '').trim();
        if (!name) continue;
        rows.push({
          companyId,
          asOfDate,
          partyType: 'creditor',
          partyName: name,
          balance: toNumber(item?.amount),
          source: 'connector'
        });
      }

      if (rows.length > 0) {
        await PartyBalanceLatest.destroy({ where: { companyId } });
        await PartyBalanceLatest.bulkCreate(rows);
      }

      if (Array.isArray(partyBalances.debtors)) {
        await CurrentDebtor.destroy({ where: { companyId } });
        if (partyBalances.debtors.length > 0) {
          await CurrentDebtor.bulkCreate(
            partyBalances.debtors
              .map((d) => ({ debtorName: String(d?.name || '').trim(), balance: toNumber(d?.amount) }))
              .filter((d) => d.debtorName)
              .map((d) => ({ companyId, ...d }))
          );
        }
      }

      if (Array.isArray(partyBalances.creditors)) {
        await CurrentCreditor.destroy({ where: { companyId } });
        if (partyBalances.creditors.length > 0) {
          await CurrentCreditor.bulkCreate(
            partyBalances.creditors
              .map((c) => ({ creditorName: String(c?.name || '').trim(), balance: toNumber(c?.amount) }))
              .filter((c) => c.creditorName)
              .map((c) => ({ companyId, ...c }))
          );
        }
      }
    } catch (error) {
      logger.warn({ companyId, error: error.message }, 'Optional block persist failed: partyBalances');
    }
  }

  if (loans && Array.isArray(loans.items)) {
    try {
      await CurrentLoan.destroy({ where: { companyId } });
      if (loans.items.length > 0) {
        await CurrentLoan.bulkCreate(
          loans.items
            .map((l) => ({
              companyId,
              loanName: String(l?.name || l?.ledgerGuid || '').trim(),
              balance: toNumber(l?.balance)
            }))
            .filter((l) => l.loanName)
        );
      }

      const loanTotal = loans.items.reduce((sum, item) => sum + toNumber(item?.balance), 0);
      await CFOMetric.upsert({
        companyId,
        metricKey: 'loans_balance_live',
        metricValue: loanTotal,
        month: monthKey,
        timeScope: 'live',
        computedAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      logger.warn({ companyId, error: error.message }, 'Optional block persist failed: loans');
    }
  }

  if (interestSummary && interestSummary.latestMonthAmount !== undefined && interestSummary.latestMonthAmount !== null) {
    try {
      await CFOMetric.upsert({
        companyId,
        metricKey: 'interest_expense_latest',
        metricValue: toNumber(interestSummary.latestMonthAmount),
        month: interestSummary.monthKey || monthKey,
        timeScope: 'latest',
        computedAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      logger.warn({ companyId, error: error.message }, 'Optional block persist failed: interestSummary');
    }
  }

  if (Array.isArray(metadata?.missingMonths) && metadata.missingMonths.length > 0) {
    try {
      const run = await IntegrationSyncRun.findOne({
        where: { companyId },
        order: [['startedAt', 'DESC']]
      });
      if (run) {
        await IntegrationSyncEvent.create({
          runId: run.id,
          level: 'warn',
          event: 'SYNC_MISSING_MONTHS_REPORTED',
          message: 'Connector reported missing historical months in payload metadata',
          data: {
            missingMonths: metadata.missingMonths,
            historicalMonthsRequested: toNumber(metadata.historicalMonthsRequested),
            historicalMonthsSynced: toNumber(metadata.historicalMonthsSynced)
          }
        });
      }
    } catch (error) {
      logger.warn({ companyId, error: error.message }, 'Optional block persist failed: metadata');
    }
  }
};

const processConnectorPayload = async (companyId, payload) => {
  try {
    logger.info({ companyId, payloadSize: JSON.stringify(payload).length }, 'Processing connector payload');

    const { chartOfAccounts, asOfDate, partyBalances, loans, interestSummary, metadata } = payload;
    
    if (!chartOfAccounts || !chartOfAccounts.ledgers) {
      throw new Error('Invalid payload: missing chartOfAccounts or ledgers');
    }

    // Extract the month key from the payload
    const monthKey = chartOfAccounts.balances?.current?.monthKey || 
                    (asOfDate ? asOfDate.substring(0, 7) : new Date().toISOString().substring(0, 7));

    // Process ledgers and balances
    const ledgers = chartOfAccounts.ledgers || [];
    const balances = chartOfAccounts.balances?.current?.items || [];
    // Ingest-time classification is fallback-only for balances-first ingestion.
    // Canonical classification still happens in monthlySnapshotService.writeLedgerMonthlyBalances,
    // which can overwrite/refine categories during snapshot recompute.
    const { classifications } = mapLedgersToCFOTotals(ledgers, chartOfAccounts.groups || []);
    const categoryByGuid = new Map(
      classifications.map((row) => [String(row.ledgerGuid || ''), String(row.category || 'unclassified')])
    );

    // Create ledger monthly balances from the payload
    const ledgerBalances = [];
    
    for (const ledger of ledgers) {
      const balanceItem = balances.find(b => b.ledgerGuid === ledger.guid);
      const balance = balanceItem ? balanceItem.balance : (ledger.closingBalance || ledger.balance || 0);
      
      if (balance !== 0) { // Only store non-zero balances
        ledgerBalances.push({
          companyId,
          ledgerGuid: ledger.guid,
          ledgerName: ledger.name,
          parentGroup: ledger.parent,
          // JS attribute is cfoCategory; Sequelize maps to DB column cfo_category.
          cfoCategory: categoryByGuid.get(String(ledger.guid || '')) || 'unclassified',
          monthKey: monthKey,
          balance: balance,
          asOfDate: asOfDate || new Date().toISOString().split('T')[0],
          source: 'connector',
          externalId: ledger.guid
        });
      }
    }

    // Store ledger monthly balances
    if (ledgerBalances.length > 0) {
      await LedgerMonthlyBalance.bulkCreate(ledgerBalances, {
        updateOnDuplicate: ['balance', 'asOfDate', 'updated_at']
      });
      
      logger.info({ companyId, monthKey, count: ledgerBalances.length }, 'Stored ledger monthly balances');
    }

    // Process closed months if provided
    const closedMonths = chartOfAccounts.balances?.closedMonths || [];
    for (const closedMonth of closedMonths) {
      if (closedMonth.monthKey && closedMonth.items) {
        const closedMonthBalances = closedMonth.items
          .filter(item => item.balance !== 0)
          .map(item => {
            const ledger = ledgers.find(l => l.guid === item.ledgerGuid);
            return {
              companyId,
              ledgerGuid: item.ledgerGuid,
              ledgerName: ledger ? ledger.name : 'Unknown',
              parentGroup: ledger ? ledger.parent : 'Unknown',
              // JS attribute is cfoCategory; Sequelize maps to DB column cfo_category.
              cfoCategory: categoryByGuid.get(String(item.ledgerGuid || '')) || 'unclassified',
              monthKey: closedMonth.monthKey,
              balance: item.balance,
              asOfDate: closedMonth.asOfDate || `${closedMonth.monthKey}-01`,
              source: 'connector',
              externalId: item.ledgerGuid
            };
          });

        if (closedMonthBalances.length > 0) {
          await LedgerMonthlyBalance.bulkCreate(closedMonthBalances, {
            updateOnDuplicate: ['balance', 'asOfDate', 'updated_at']
          });
          
          logger.info({ companyId, monthKey: closedMonth.monthKey, count: closedMonthBalances.length }, 'Stored closed month balances');
        }
      }
    }

    // Trigger monthly snapshot generation for the affected month
    await enqueueJob('generateMonthlySnapshots', {
      companyId,
      amendedMonth: monthKey,
      debtors: null, // Will be derived from ledger balances
      creditors: null, // Will be derived from ledger balances
      currentBalances: null, // Will be calculated from ledger balances
      chartOfAccounts: chartOfAccounts
    });

    await persistOptionalConnectorBlocks(companyId, {
      partyBalances,
      loans,
      interestSummary,
      metadata
    }, monthKey);

    logger.info({ companyId, monthKey }, 'Successfully processed connector payload');

  } catch (error) {
    logger.error({ companyId, error: error.message }, 'Failed to process connector payload');
    throw error;
  }
};

module.exports = {
  getIntegrations,
  connectTally,
  connectZoho,
  connectQuickBooks,
  disconnectIntegration,
  syncIntegration,
  processConnectorPayload
};
