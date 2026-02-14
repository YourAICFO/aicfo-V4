#!/usr/bin/env node

/**
 * Test script to verify connector setup and API connectivity
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

async function testConnection() {
  console.log('🧪 Testing AI CFO Connector Setup...\n');

  try {
    // Load configuration
    const configPath = path.join(process.cwd(), 'config.json');
    let config;
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
      console.log('✅ Configuration loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load config.json:', error.message);
      console.log('💡 Run "npm start" first to create default config.json');
      return;
    }

    // Validate configuration
    const requiredFields = ['api_url', 'company_id', 'connector_token'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required configuration fields:', missingFields.join(', '));
      console.log('💡 Please update config.json with your actual API credentials');
      return;
    }

    console.log('✅ Configuration validation passed');

    // Test API connection
    console.log('\n🌐 Testing API connection...');
    
    const apiClient = axios.create({
      baseURL: config.api_url,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${config.connector_token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AICFO-Connector-Test/1.0.0'
      }
    });

    try {
      const response = await apiClient.get('/connector/status');
      
      if (response.data && response.data.success) {
        console.log('✅ API connection successful');
        console.log('📊 Connector status:', response.data.data);
      } else {
        console.warn('⚠️  API responded but with unexpected format');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error('❌ Authentication failed - invalid connector token');
        console.log('💡 Please check your connector_token in config.json');
      } else if (error.response && error.response.status === 404) {
        console.error('❌ API endpoint not found - check api_url in config.json');
      } else {
        console.error('❌ API connection failed:', error.message);
      }
      return;
    }

    // Test heartbeat
    console.log('\n💓 Testing heartbeat...');
    
    try {
      const heartbeatResponse = await apiClient.post('/connector/heartbeat', {
        companyId: config.company_id
      });
      
      if (heartbeatResponse.data && heartbeatResponse.data.success) {
        console.log('✅ Heartbeat successful');
        console.log('⏰ Server time:', heartbeatResponse.data.data.serverTime);
      } else {
        console.warn('⚠️  Heartbeat responded but with unexpected format');
      }
    } catch (error) {
      console.error('❌ Heartbeat failed:', error.message);
      return;
    }

    // Test mock data ingestion (optional)
    console.log('\n📊 Testing mock data ingestion...');
    
    const mockPayload = {
      chartOfAccounts: {
        source: 'tally',
        generatedAt: new Date().toISOString(),
        groups: [
          {
            name: 'Test Debtors',
            parent: 'Current Assets',
            guid: 'test-group-001',
            type: 'Group'
          }
        ],
        ledgers: [
          {
            guid: 'test-ledger-001',
            name: 'Test Customer',
            parent: 'Test Debtors',
            groupName: 'Test Debtors',
            type: 'Ledger'
          }
        ],
        balances: {
          current: {
            monthKey: new Date().toISOString().substring(0, 7),
            asOfDate: new Date().toISOString().split('T')[0],
            items: [
              {
                ledgerGuid: 'test-ledger-001',
                balance: 1000.00
              }
            ]
          },
          closedMonths: []
        }
      },
      asOfDate: new Date().toISOString().split('T')[0]
    };

    try {
      const syncResponse = await apiClient.post('/connector/sync', mockPayload);
      
      if (syncResponse.data && syncResponse.data.success) {
        console.log('✅ Mock data ingestion successful');
        console.log('📋 Response:', syncResponse.data.data);
      } else {
        console.warn('⚠️  Data ingestion responded but with unexpected format');
      }
    } catch (error) {
      console.error('❌ Data ingestion failed:', error.message);
      if (error.response && error.response.data) {
        console.error('📋 Error details:', error.response.data);
      }
      return;
    }

    console.log('\n🎉 All tests passed! Connector is ready to use.');
    console.log('\n📋 Next steps:');
    console.log('   1. Run the connector: node src/index.js');
    console.log('   2. Or build the executable: npm run build');
    console.log('   3. Package for distribution: npm run build:zip');

  } catch (error) {
    console.error('❌ Test failed with unexpected error:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testConnection().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testConnection };