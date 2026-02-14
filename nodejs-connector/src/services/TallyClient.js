const axios = require('axios');

class TallyClient {
  constructor(tallyUrl, logger) {
    this.tallyUrl = tallyUrl || 'http://localhost:9000';
    this.logger = logger;
    this.isConnectedFlag = false;
  }

  async testConnection() {
    try {
      this.logger.info(`Testing connection to Tally at ${this.tallyUrl}...`);
      
      // Try to connect to Tally API
      const response = await axios.get(`${this.tallyUrl}/api/health`, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        this.isConnectedFlag = true;
        this.logger.info('Successfully connected to Tally');
        return true;
      } else {
        this.logger.warn(`Tally health check returned status ${response.status}`);
        this.isConnectedFlag = false;
        return false;
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        this.logger.warn('Tally connection refused - Tally may not be running or API not enabled');
      } else if (error.code === 'ETIMEDOUT') {
        this.logger.warn('Tally connection timed out');
      } else {
        this.logger.warn(`Tally connection test failed: ${error.message}`);
      }
      
      this.isConnectedFlag = false;
      return false;
    }
  }

  async getChartOfAccounts() {
    try {
      if (!this.isConnectedFlag) {
        this.logger.warn('Tally not connected, returning null for chart of accounts');
        return null;
      }

      this.logger.info('Fetching chart of accounts from Tally...');
      
      // For MVP, we'll return null to trigger mock data generation
      // In production, this would make actual API calls to Tally
      
      // Example of what the real implementation would look like:
      /*
      const response = await axios.post(`${this.tallyUrl}/api/chart-of-accounts`, {
        company: companyName
      }, {
        timeout: 30000
      });

      if (response.data && response.data.success) {
        return response.data.data;
      }
      */

      this.logger.info('Chart of accounts fetch not implemented for MVP, returning null');
      return null;

    } catch (error) {
      this.logger.error('Failed to fetch chart of accounts from Tally:', error);
      return null;
    }
  }

  async getLedgers() {
    try {
      if (!this.isConnectedFlag) {
        this.logger.warn('Tally not connected, returning null for ledgers');
        return null;
      }

      this.logger.info('Fetching ledgers from Tally...');
      
      // For MVP, we'll return null to trigger mock data generation
      // In production, this would make actual API calls to Tally
      
      // Example of what the real implementation would look like:
      /*
      const response = await axios.post(`${this.tallyUrl}/api/ledgers`, {
        company: companyName
      }, {
        timeout: 30000
      });

      if (response.data && response.data.success) {
        return response.data.data;
      }
      */

      this.logger.info('Ledgers fetch not implemented for MVP, returning null');
      return null;

    } catch (error) {
      this.logger.error('Failed to fetch ledgers from Tally:', error);
      return null;
    }
  }

  async getVouchers(companyName, fromDate, toDate) {
    try {
      if (!this.isConnectedFlag) {
        this.logger.warn('Tally not connected, returning null for vouchers');
        return null;
      }

      this.logger.info(`Fetching vouchers from Tally for company: ${companyName}...`);
      
      // For MVP, we'll return null
      // In production, this would make actual API calls to Tally
      
      this.logger.info('Vouchers fetch not implemented for MVP, returning null');
      return null;

    } catch (error) {
      this.logger.error('Failed to fetch vouchers from Tally:', error);
      return null;
    }
  }

  async getCompanies() {
    try {
      if (!this.isConnectedFlag) {
        this.logger.warn('Tally not connected, returning empty list for companies');
        return [];
      }

      this.logger.info('Fetching companies from Tally...');
      
      // For MVP, we'll return a default company
      // In production, this would make actual API calls to Tally
      
      return [{
        name: 'Default Company',
        isActive: true,
        guid: 'default-company-guid'
      }];

    } catch (error) {
      this.logger.error('Failed to fetch companies from Tally:', error);
      return [];
    }
  }

  isConnected() {
    return this.isConnectedFlag;
  }

  // Helper method to generate Tally XML requests (for future implementation)
  generateXmlRequest(requestType, params = {}) {
    // This would generate proper Tally XML requests
    // For now, returning empty string as we're using mock data
    return '';
  }

  // Helper method to parse Tally XML responses (for future implementation)
  parseXmlResponse(xmlResponse, responseType) {
    // This would parse Tally XML responses
    // For now, returning empty object as we're using mock data
    return {};
  }
}

module.exports = TallyClient;