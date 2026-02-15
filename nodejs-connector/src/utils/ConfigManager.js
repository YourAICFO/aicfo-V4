const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.config = null;
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Create default config if it doesn't exist
        await this.createDefaultConfig();
        return this.config;
      }
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  async createDefaultConfig() {
    const defaultConfig = {
      api_url: 'https://your-api-domain.com/api',
      company_id: 'your-company-id',
      connector_token: 'your-connector-token',
      tally_url: 'http://localhost:9000',
      sync_interval_minutes: 30,
      heartbeat_interval_seconds: 30,
      max_retry_attempts: 3,
      retry_delay_seconds: 5,
      log_level: 'info',
      connector_allow_mock: true
    };

    try {
      await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
      this.config = defaultConfig;
      console.log('Created default config.json. Please update it with your actual configuration.');
    } catch (error) {
      throw new Error(`Failed to create default config: ${error.message}`);
    }
  }

  async updateConfig(updates) {
    try {
      if (!this.config) {
        await this.loadConfig();
      }

      this.config = { ...this.config, ...updates };
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      return this.config;
    } catch (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  getConfig() {
    return this.config;
  }

  validateConfig() {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const requiredFields = ['api_url', 'company_id', 'connector_token'];
    const missingFields = requiredFields.filter(field => !this.config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }

    return true;
  }
}

module.exports = ConfigManager;
