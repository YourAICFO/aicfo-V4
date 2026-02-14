const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function packageConnector() {
  console.log('Packaging AI CFO Connector...');

  try {
    // Create distribution directory
    const distDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(distDir, { recursive: true });

    // Copy executable
    const exeSource = path.join(process.cwd(), 'AICFOConnector.exe');
    const exeDest = path.join(distDir, 'AICFOConnector.exe');
    
    try {
      await fs.copyFile(exeSource, exeDest);
      console.log('✓ Copied AICFOConnector.exe');
    } catch (error) {
      console.error('✗ Failed to copy executable:', error.message);
      console.log('  Make sure to run "npm run build" first to create the executable');
      process.exit(1);
    }

    // Create config.json with default values
    const defaultConfig = {
      api_url: 'https://api.aicfo.com/api',
      company_id: 'your-company-id',
      connector_token: 'your-connector-token',
      tally_url: 'http://localhost:9000',
      sync_interval_minutes: 30,
      heartbeat_interval_seconds: 30,
      max_retry_attempts: 3,
      retry_delay_seconds: 5,
      log_level: 'info'
    };

    const configPath = path.join(distDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✓ Created config.json');

    // Create run-connector.bat
    const batchContent = `@echo off
echo Starting AI CFO Connector...
echo.
echo Make sure to update config.json with your actual configuration before running.
echo.
AICFOConnector.exe
pause`;

    const batchPath = path.join(distDir, 'run-connector.bat');
    await fs.writeFile(batchPath, batchContent);
    console.log('✓ Created run-connector.bat');

    // Create README.txt
    const readmeContent = `AI CFO Connector - Windows Edition
Version 1.0.0

INSTALLATION AND USAGE:
1. Extract all files to a folder (e.g., C:\\AICFOConnector)
2. Edit config.json with your actual configuration:
   - api_url: Your AI CFO API endpoint
   - company_id: Your company ID
   - connector_token: Your connector token
3. Run run-connector.bat as Administrator
4. The connector will start and begin syncing data

SYSTEM REQUIREMENTS:
- Windows 7 or later
- Node.js 18+ (included in executable)
- Tally ERP 9/Prime with API enabled (optional for MVP)

CONFIGURATION:
The connector reads configuration from config.json in the same directory.

LOGGING:
Logs are written to logs\\connector.log
Error logs are written to logs\\connector-error.log

SUPPORT:
For support, please contact AI CFO support team.

© 2024 AI CFO. All rights reserved.`;

    const readmePath = path.join(distDir, 'README.txt');
    await fs.writeFile(readmePath, readmeContent);
    console.log('✓ Created README.txt');

    // Create ZIP file
    console.log('Creating ZIP distribution...');
    
    try {
      // Use built-in Windows compression if available, otherwise use a simple approach
      const zipFileName = 'AICFOConnector.zip';
      const zipPath = path.join(process.cwd(), zipFileName);
      
      // For cross-platform compatibility, we'll create a simple archive
      // In production, you might want to use a proper ZIP library
      console.log('✓ Distribution files prepared in dist/ folder');
      console.log('✓ To create ZIP manually, compress the contents of the dist/ folder');
      
      console.log('\n📦 Packaging complete!');
      console.log('📁 Distribution files are in: dist/');
      console.log('📋 Next steps:');
      console.log('   1. Compress the dist/ folder contents into AICFOConnector.zip');
      console.log('   2. Upload the ZIP file to your download server');
      console.log('   3. Update the download URL in your backend configuration');
      
    } catch (error) {
      console.error('✗ Failed to create ZIP:', error.message);
      console.log('  Please create the ZIP file manually from the dist/ folder');
    }

  } catch (error) {
    console.error('✗ Packaging failed:', error);
    process.exit(1);
  }
}

// Run the packaging script
if (require.main === module) {
  packageConnector().catch(error => {
    console.error('Packaging error:', error);
    process.exit(1);
  });
}

module.exports = { packageConnector };