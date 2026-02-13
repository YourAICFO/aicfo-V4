const axios = require('axios');
const { logger } = require('../utils/logger');

class TallyClient {
  constructor(serverUrl = 'http://localhost:9000') {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = 30000; // 30 seconds timeout
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: this.timeout,
        validateStatus: (status) => status < 500
      });
      return response.status === 200;
    } catch (error) {
      logger.error({ error: error.message, serverUrl: this.serverUrl }, 'Tally connection test failed');
      return false;
    }
  }

  async getCompanies() {
    try {
      const response = await axios.get(`${this.serverUrl}/companies`, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error({ error: error.message, serverUrl: this.serverUrl }, 'Failed to fetch Tally companies');
      throw new Error(`Failed to connect to Tally: ${error.message}`);
    }
  }

  async getVouchers(companyName, fromDate = null, toDate = null) {
    try {
      const params = { company: companyName };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await axios.get(`${this.serverUrl}/vouchers`, {
        timeout: this.timeout,
        params,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error({ error: error.message, companyName, serverUrl: this.serverUrl }, 'Failed to fetch Tally vouchers');
      throw new Error(`Failed to fetch vouchers: ${error.message}`);
    }
  }

  async getLedgers(companyName) {
    try {
      const response = await axios.get(`${this.serverUrl}/ledgers`, {
        timeout: this.timeout,
        params: { company: companyName },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error({ error: error.message, companyName, serverUrl: this.serverUrl }, 'Failed to fetch Tally ledgers');
      throw new Error(`Failed to fetch ledgers: ${error.message}`);
    }
  }

  async getChartOfAccounts(companyName) {
    try {
      const response = await axios.get(`${this.serverUrl}/chart-of-accounts`, {
        timeout: this.timeout,
        params: { company: companyName },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error({ error: error.message, companyName, serverUrl: this.serverUrl }, 'Failed to fetch Tally chart of accounts');
      throw new Error(`Failed to fetch chart of accounts: ${error.message}`);
    }
  }

  async getBalanceSheet(companyName, asOfDate = null) {
    try {
      const params = { company: companyName };
      if (asOfDate) params.as_of_date = asOfDate;

      const response = await axios.get(`${this.serverUrl}/balance-sheet`, {
        timeout: this.timeout,
        params,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error({ error: error.message, companyName, serverUrl: this.serverUrl }, 'Failed to fetch Tally balance sheet');
      throw new Error(`Failed to fetch balance sheet: ${error.message}`);
    }
  }

  async getTrialBalance(companyName, fromDate = null, toDate = null) {
    try {
      const params = { company: companyName };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await axios.get(`${this.serverUrl}/trial-balance`, {
        timeout: this.timeout,
        params,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error({ error: error.message, companyName, serverUrl: this.serverUrl }, 'Failed to fetch Tally trial balance');
      throw new Error(`Failed to fetch trial balance: ${error.message}`);
    }
  }
}

module.exports = { TallyClient };