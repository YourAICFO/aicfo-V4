#!/usr/bin/env node

const path = require('path');
const fs = require('fs').promises;
const ConnectorService = require('./services/ConnectorService');
const Logger = require('./utils/Logger');
const ConfigManager = require('./utils/ConfigManager');

class AICFOConnector {
  constructor() {
    this.logger = new Logger();
    this.configManager = new ConfigManager();
    this.connectorService = null;
    this.isRunning = false;
    this.shutdownInProgress = false;
  }

  async start() {
    try {
      this.logger.info('Starting AI CFO Connector...');
      
      // Load configuration
      const config = await this.configManager.loadConfig();
      if (!config) {
        this.logger.error('Failed to load configuration. Please ensure config.json exists.');
        process.exit(1);
      }

      // Validate configuration
      if (!config.api_url || !config.company_id || !config.connector_token) {
        this.logger.error('Invalid configuration. Required fields: api_url, company_id, connector_token');
        process.exit(1);
      }

      // Initialize connector service
      this.connectorService = new ConnectorService(config, this.logger);
      
      // Start the connector
      await this.connectorService.start();
      
      this.isRunning = true;
      this.logger.info('AI CFO Connector started successfully');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start connector:', error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.shutdownInProgress) {
        this.logger.warn('Shutdown already in progress...');
        return;
      }

      this.shutdownInProgress = true;
      this.logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        if (this.connectorService) {
          await this.connectorService.stop();
        }
        
        this.logger.info('Connector stopped successfully');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }
}

// Main entry point
if (require.main === module) {
  const connector = new AICFOConnector();
  connector.start().catch(error => {
    console.error('Failed to start connector:', error);
    process.exit(1);
  });
}

module.exports = AICFOConnector;