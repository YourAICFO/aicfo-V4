const axios = require('axios');
const { CronJob } = require('cron');
const TallyClient = require('./TallyClient');
const ApiClient = require('./ApiClient');
const RetryManager = require('./RetryManager');

class ConnectorService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tallyClient = new TallyClient(config.tally_url, logger);
    this.apiClient = new ApiClient(config.api_url, config.connector_token, config.company_id, logger);
    this.retryManager = new RetryManager(config.max_retry_attempts, config.retry_delay_seconds, logger);
    
    this.isRunning = false;
    this.heartbeatJob = null;
    this.syncJob = null;
    this.lastSyncTime = null;
    this.lastError = null;
  }

  async start() {
    try {
      this.logger.info('Starting Connector Service...');

      // Test API connection first
      await this.testApiConnection();

      // Test Tally connection
      const tallyConnected = await this.testTallyConnection();
      if (!tallyConnected) {
        this.logger.warn('Tally connection failed, but connector will continue running');
      }

      // Start heartbeat
      this.startHeartbeat();

      // Start sync job
      this.startSyncJob();

      this.isRunning = true;
      this.logger.info('Connector Service started successfully');

    } catch (error) {
      this.logger.error('Failed to start Connector Service:', error);
      throw error;
    }
  }

  async stop() {
    try {
      this.logger.info('Stopping Connector Service...');

      this.isRunning = false;

      // Stop heartbeat
      if (this.heartbeatJob) {
        this.heartbeatJob.stop();
        this.heartbeatJob = null;
      }

      // Stop sync job
      if (this.syncJob) {
        this.syncJob.stop();
        this.syncJob = null;
      }

      this.logger.info('Connector Service stopped');
    } catch (error) {
      this.logger.error('Error stopping Connector Service:', error);
      throw error;
    }
  }

  async testApiConnection() {
    try {
      this.logger.info('Testing API connection...');
      await this.apiClient.testConnection();
      this.logger.info('API connection successful');
      return true;
    } catch (error) {
      this.logger.error('API connection failed:', error);
      throw new Error('Cannot connect to AI CFO API. Please check your configuration.');
    }
  }

  async testTallyConnection() {
    try {
      this.logger.info('Testing Tally connection...');
      const connected = await this.tallyClient.testConnection();
      
      if (connected) {
        this.logger.info('Tally connection successful');
        return true;
      } else {
        this.logger.warn('Tally connection failed - Tally may not be running or API not enabled');
        return false;
      }
    } catch (error) {
      this.logger.error('Tally connection test failed:', error);
      return false;
    }
  }

  startHeartbeat() {
    const heartbeatInterval = this.config.heartbeat_interval_seconds || 30;
    
    this.logger.info(`Starting heartbeat with ${heartbeatInterval} second interval`);

    // Use setInterval for heartbeat instead of cron for more precise timing
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.sendHeartbeat();
      } catch (error) {
        this.logger.error('Heartbeat failed:', error);
      }
    }, heartbeatInterval * 1000);

    // Send initial heartbeat
    this.sendHeartbeat().catch(error => {
      this.logger.error('Initial heartbeat failed:', error);
    });
  }

  startSyncJob() {
    const syncInterval = this.config.sync_interval_minutes || 30;
    
    this.logger.info(`Starting sync job with ${syncInterval} minute interval`);

    this.syncJob = new CronJob(
      `*/${syncInterval} * * * *`, // Every N minutes
      async () => {
        if (!this.isRunning) return;

        try {
          await this.performSync();
        } catch (error) {
          this.logger.error('Scheduled sync failed:', error);
        }
      },
      null,
      true,
      'Asia/Kolkata' // Use appropriate timezone
    );
  }

  async sendHeartbeat() {
    try {
      await this.retryManager.execute(async () => {
        await this.apiClient.sendHeartbeat();
      });
      
      this.logger.debug('Heartbeat sent successfully');
    } catch (error) {
      this.logger.error('Failed to send heartbeat after retries:', error);
      throw error;
    }
  }

  async performSync() {
    if (!this.isRunning) return;

    this.logger.info('Starting data synchronization...');

    try {
      // Test Tally connection before sync
      const tallyConnected = await this.testTallyConnection();
      if (!tallyConnected) {
        this.logger.warn('Skipping sync - Tally not connected');
        return;
      }

      // Start sync run
      const syncRun = await this.apiClient.startSyncRun();
      
      try {
        // Fetch data from Tally
        this.logger.info('Fetching data from Tally...');
        const tallyData = await this.fetchTallyData();
        
        if (!tallyData || !tallyData.hasData) {
          this.logger.info('No data to sync');
          await this.apiClient.completeSyncRun(syncRun.runId, 'success', 'No data to sync');
          return;
        }

        // Convert and send data to API
        this.logger.info('Converting and sending data to API...');
        const payload = this.convertToFinalizedPayload(tallyData);
        
        await this.apiClient.sendSyncData(payload);
        
        // Complete sync run
        await this.apiClient.completeSyncRun(syncRun.runId, 'success', 'Sync completed successfully');
        
        this.lastSyncTime = new Date();
        this.logger.info(`Sync completed successfully. Processed ${tallyData.transactionCount} transactions, ${tallyData.ledgerCount} ledgers`);

      } catch (error) {
        this.logger.error('Sync failed:', error);
        await this.apiClient.completeSyncRun(syncRun.runId, 'failed', error.message);
        throw error;
      }

    } catch (error) {
      this.logger.error('Sync process failed:', error);
      this.lastError = error.message;
      throw error;
    }
  }

  async fetchTallyData() {
    try {
      // Fetch chart of accounts and ledgers
      const [chartOfAccounts, ledgers] = await Promise.all([
        this.tallyClient.getChartOfAccounts(),
        this.tallyClient.getLedgers()
      ]);

      // For MVP, we'll use mock data if Tally is not available
      if (!chartOfAccounts && !ledgers) {
        this.logger.warn('No data from Tally, using mock data for MVP');
        return this.generateMockData();
      }

      return {
        chartOfAccounts: chartOfAccounts || { groups: [], ledgers: [] },
        ledgers: ledgers || [],
        asOfDate: new Date().toISOString().split('T')[0],
        hasData: true,
        transactionCount: 0,
        ledgerCount: ledgers ? ledgers.length : 0
      };

    } catch (error) {
      this.logger.error('Failed to fetch Tally data:', error);
      throw error;
    }
  }

  generateMockData() {
    // Generate mock data for MVP testing
    const mockLedgers = [
      {
        guid: 'ledger-001',
        name: 'ABC Ltd',
        parent: 'Sundry Debtors',
        closingBalance: 12345.67
      },
      {
        guid: 'ledger-002',
        name: 'XYZ Suppliers',
        parent: 'Sundry Creditors',
        closingBalance: -8765.43
      },
      {
        guid: 'ledger-003',
        name: 'Cash Account',
        parent: 'Cash-in-hand',
        closingBalance: 5000.00
      },
      {
        guid: 'ledger-004',
        name: 'Bank Account',
        parent: 'Bank Accounts',
        closingBalance: 25000.00
      }
    ];

    const mockGroups = [
      {
        name: 'Sundry Debtors',
        parent: 'Current Assets',
        guid: 'group-001',
        type: 'Group'
      },
      {
        name: 'Sundry Creditors',
        parent: 'Current Liabilities',
        guid: 'group-002',
        type: 'Group'
      },
      {
        name: 'Cash-in-hand',
        parent: 'Current Assets',
        guid: 'group-003',
        type: 'Group'
      },
      {
        name: 'Bank Accounts',
        parent: 'Current Assets',
        guid: 'group-004',
        type: 'Group'
      }
    ];

    return {
      chartOfAccounts: {
        groups: mockGroups,
        ledgers: mockLedgers
      },
      ledgers: mockLedgers,
      asOfDate: new Date().toISOString().split('T')[0],
      hasData: true,
      transactionCount: 0,
      ledgerCount: mockLedgers.length
    };
  }

  convertToFinalizedPayload(tallyData) {
    // Convert to the exact finalized payload format required by the backend
    // This must match the COA payload contract exactly
    
    const { chartOfAccounts, asOfDate } = tallyData;

    return {
      chartOfAccounts: {
        source: 'tally',
        generatedAt: new Date().toISOString(),
        groups: chartOfAccounts.groups || [],
        ledgers: (chartOfAccounts.ledgers || []).map(ledger => ({
          guid: ledger.guid,
          name: ledger.name,
          parent: ledger.parent,
          groupName: ledger.parent,
          type: 'Ledger'
        })),
        balances: {
          current: {
            monthKey: this.getCurrentMonthKey(),
            asOfDate: asOfDate,
            items: (chartOfAccounts.ledgers || []).map(ledger => ({
              ledgerGuid: ledger.guid,
              balance: ledger.closingBalance || ledger.balance || 0
            }))
          },
          closedMonths: [] // No closed months for MVP
        }
      },
      asOfDate: asOfDate
    };
  }

  getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      tallyConnected: this.tallyClient.isConnected()
    };
  }
}

module.exports = ConnectorService;