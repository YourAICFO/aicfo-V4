const axios = require('axios');

class ApiClient {
  constructor(apiUrl, connectorToken, companyId, logger) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.connectorToken = connectorToken;
    this.companyId = companyId;
    this.logger = logger;
    
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.connectorToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AICFO-Connector/1.0.0'
      }
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`API Response: ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          this.logger.error(`API Error: ${error.response.status} ${error.config.method.toUpperCase()} ${error.config.url}`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          });
        } else if (error.request) {
          this.logger.error(`API Request Error: ${error.config.method.toUpperCase()} ${error.config.url}`, {
            message: error.message
          });
        } else {
          this.logger.error(`API Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  async testConnection() {
    try {
      this.logger.info('Testing API connection...');
      
      const response = await this.client.get('/connector/status');
      
      if (response.data && response.data.success) {
        this.logger.info('API connection test successful');
        return true;
      } else {
        throw new Error('API connection test failed - invalid response format');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('Invalid connector token - please check your configuration');
      } else if (error.response && error.response.status === 404) {
        throw new Error('API endpoint not found - please check your api_url configuration');
      } else {
        throw new Error(`API connection test failed: ${error.message}`);
      }
    }
  }

  async sendHeartbeat() {
    try {
      this.logger.debug('Sending heartbeat...');
      
      const response = await this.client.post('/connector/heartbeat', {
        companyId: this.companyId
      });

      if (response.data && response.data.success) {
        this.logger.debug('Heartbeat sent successfully');
        return response.data.data;
      } else {
        throw new Error('Invalid heartbeat response format');
      }
    } catch (error) {
      this.logger.error('Heartbeat failed:', error);
      throw error;
    }
  }

  async startSyncRun() {
    try {
      this.logger.info('Starting sync run...');
      
      const response = await this.client.post('/connector/sync/start', {
        companyId: this.companyId
      });

      if (response.data && response.data.success) {
        const { runId, status } = response.data.data;
        this.logger.info(`Sync run started: ${runId}`);
        return { runId, status };
      } else {
        throw new Error('Invalid sync start response format');
      }
    } catch (error) {
      this.logger.error('Failed to start sync run:', error);
      throw error;
    }
  }

  async updateSyncProgress(runId, stage, progress, message, stats = {}) {
    try {
      this.logger.debug(`Updating sync progress: ${stage} - ${progress}%`);
      
      const response = await this.client.post('/connector/sync/progress', {
        runId,
        stage,
        progress,
        message,
        stats
      });

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error('Invalid sync progress response format');
      }
    } catch (error) {
      this.logger.error('Failed to update sync progress:', error);
      throw error;
    }
  }

  async completeSyncRun(runId, status, lastError = null) {
    try {
      this.logger.info(`Completing sync run: ${status}`);
      
      const response = await this.client.post('/connector/sync/complete', {
        runId,
        status,
        finishedAt: new Date().toISOString(),
        lastError
      });

      if (response.data && response.data.success) {
        this.logger.info('Sync run completed successfully');
        return response.data.data;
      } else {
        throw new Error('Invalid sync complete response format');
      }
    } catch (error) {
      this.logger.error('Failed to complete sync run:', error);
      throw error;
    }
  }

  async sendSyncData(payload) {
    try {
      this.logger.info('Sending sync data to API...');
      
      // This is the main endpoint that sends the finalized COA payload
      const response = await this.client.post('/connector/sync', payload);

      if (response.data && response.data.success) {
        this.logger.info('Sync data sent successfully');
        return response.data.data;
      } else {
        throw new Error('Invalid sync data response format');
      }
    } catch (error) {
      this.logger.error('Failed to send sync data:', error);
      throw error;
    }
  }

  // Helper method to validate the payload before sending
  validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: must be an object');
    }

    if (!payload.chartOfAccounts) {
      throw new Error('Invalid payload: missing chartOfAccounts');
    }

    if (!Array.isArray(payload.chartOfAccounts.ledgers)) {
      throw new Error('Invalid payload: chartOfAccounts.ledgers must be an array');
    }

    if (payload.chartOfAccounts.ledgers.length === 0) {
      throw new Error('Invalid payload: chartOfAccounts.ledgers cannot be empty');
    }

    // Validate each ledger
    for (const ledger of payload.chartOfAccounts.ledgers) {
      if (!ledger.name || !ledger.parent || !ledger.guid) {
        throw new Error('Invalid ledger: missing required fields (name, parent, guid)');
      }
    }

    return true;
  }
}

module.exports = ApiClient;