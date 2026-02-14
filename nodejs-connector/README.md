# AI CFO Connector - Node.js Implementation

A Windows desktop connector for AI CFO that reads accounting data from Tally and sends it to the AI CFO backend.

## Overview

This is a Node.js-based replacement for the C# connector, providing:
- **Cross-platform compatibility** (primarily Windows-focused)
- **Lightweight deployment** using pkg for executable compilation
- **Robust error handling** with exponential backoff retry logic
- **Secure authentication** using connector tokens
- **Automatic synchronization** with configurable intervals
- **Heartbeat monitoring** to maintain connection status

## Architecture

```
nodejs-connector/
├── src/
│   ├── index.js              # Main entry point
│   ├── services/
│   │   ├── ConnectorService.js  # Main orchestration service
│   │   ├── TallyClient.js       # Tally API client (mock for MVP)
│   │   ├── ApiClient.js         # Backend API client
│   │   └── RetryManager.js      # Retry logic with exponential backoff
│   └── utils/
│       ├── Logger.js           # Winston-based logging
│       └── ConfigManager.js    # Configuration management
├── scripts/
│   └── package.js            # Packaging script for distribution
├── package.json              # Dependencies and build configuration
└── README.md                 # This file
```

## Features

### ✅ Implemented
- **Configuration Management**: JSON-based configuration with validation
- **Logging**: Comprehensive logging with rotation and error separation
- **Authentication**: Secure connector token-based authentication
- **Heartbeat**: Regular heartbeat to maintain connection status
- **Data Synchronization**: Automated sync with configurable intervals
- **Retry Logic**: Exponential backoff with jitter for failed requests
- **Graceful Shutdown**: Proper cleanup on termination signals
- **Mock Tally Integration**: MVP implementation with mock data
- **Payload Conversion**: Converts Tally data to finalized COA format
- **Error Handling**: Comprehensive error handling and logging

### 🔄 In Progress
- **Real Tally Integration**: Full Tally API implementation
- **Backdated Updates**: Handling of historical data updates
- **Advanced Monitoring**: Enhanced status reporting

### 📋 Planned
- **Company Selection**: UI for selecting Tally companies
- **Advanced Scheduling**: More sophisticated sync scheduling
- **Performance Optimization**: Batch processing and optimization

## Installation

### Development Setup

1. **Clone and install dependencies:**
```bash
cd nodejs-connector
npm install
```

2. **Create configuration:**
```bash
npm start
# This will create a default config.json file
```

3. **Edit config.json:**
```json
{
  "api_url": "https://your-api-domain.com/api",
  "company_id": "your-company-id",
  "connector_token": "your-connector-token",
  "tally_url": "http://localhost:9000",
  "sync_interval_minutes": 30,
  "heartbeat_interval_seconds": 30,
  "max_retry_attempts": 3,
  "retry_delay_seconds": 5,
  "log_level": "info"
}
```

4. **Run in development:**
```bash
npm run dev
```

### Production Build

1. **Build executable:**
```bash
npm run build
```

2. **Package for distribution:**
```bash
npm run build:zip
```

3. **Distribute the ZIP file:**
   - The `dist/` folder contains all necessary files
   - Compress into `AICFOConnector.zip` for distribution

## Configuration

### Required Fields
- `api_url`: Your AI CFO API endpoint
- `company_id`: Your company ID
- `connector_token`: Your connector authentication token

### Optional Fields
- `tally_url`: Tally API endpoint (default: `http://localhost:9000`)
- `sync_interval_minutes`: Sync frequency (default: 30)
- `heartbeat_interval_seconds`: Heartbeat frequency (default: 30)
- `max_retry_attempts`: Maximum retry attempts (default: 3)
- `retry_delay_seconds`: Base retry delay (default: 5)
- `log_level`: Logging level (default: `info`)

## API Integration

### Authentication
The connector uses bearer token authentication with the backend API:
```
Authorization: Bearer <connector_token>
```

### Endpoints Used
- `POST /connector/heartbeat` - Heartbeat signal
- `POST /connector/sync/start` - Start sync run
- `POST /connector/sync` - Send sync data (main payload)
- `POST /connector/sync/complete` - Complete sync run

### Payload Format
The connector sends data in the finalized COA format as specified in the backend contract:

```json
{
  "chartOfAccounts": {
    "source": "tally",
    "generatedAt": "2026-02-10T10:00:00.000Z",
    "groups": [...],
    "ledgers": [...],
    "balances": {
      "current": {
        "monthKey": "2026-02",
        "asOfDate": "2026-02-10",
        "items": [...]
      },
      "closedMonths": [...]
    }
  },
  "asOfDate": "2026-02-10"
}
```

## Logging

Logs are written to:
- `logs/connector.log` - Main application logs
- `logs/connector-error.log` - Error logs only

Log rotation is automatic with:
- Maximum file size: 10MB
- Maximum files: 5 (main), 3 (errors)
- Oldest files are automatically deleted

## Error Handling

The connector implements comprehensive error handling:

### Retry Logic
- **Exponential backoff**: Delay increases exponentially with each retry
- **Jitter**: Random variation to prevent thundering herd
- **Configurable**: Max attempts and base delay are configurable

### Error Types
- **Network errors**: Connection refused, timeout, etc.
- **API errors**: 4xx and 5xx HTTP status codes
- **Validation errors**: Invalid configuration or payload
- **Tally errors**: Tally connection or data issues

### Graceful Degradation
- Continues running if Tally is unavailable (uses mock data for MVP)
- Retries failed API calls with exponential backoff
- Maintains heartbeat even during sync failures

## Security

### Token Management
- Connector tokens are long-lived but rotatable
- Tokens are hashed in the backend database
- No user JWT tokens are used in the connector

### Data Transmission
- All API calls use HTTPS (configure `api_url` accordingly)
- Sensitive data is not logged
- Configuration files contain tokens and should be secured

## Deployment

### Distribution Package
The distribution package includes:
- `AICFOConnector.exe` - Main executable
- `config.json` - Configuration file
- `run-connector.bat` - Launch script
- `README.txt` - User documentation

### Installation Steps
1. Extract ZIP file to target directory
2. Edit `config.json` with actual configuration
3. Run `run-connector.bat` as Administrator
4. Monitor logs in `logs/` directory

### System Requirements
- Windows 7 or later
- 50MB free disk space
- Network access to Tally (if using real Tally integration)
- Network access to AI CFO API

## Development

### Project Structure
```
src/
├── index.js              # Main entry point with graceful shutdown
├── services/
│   ├── ConnectorService.js  # Main orchestration logic
│   ├── TallyClient.js       # Tally integration (mock for MVP)
│   ├── ApiClient.js         # Backend API integration
│   └── RetryManager.js      # Retry logic implementation
└── utils/
    ├── Logger.js           # Winston-based logging
    └── ConfigManager.js    # Configuration management
```

### Adding New Features
1. Implement in appropriate service or create new service
2. Update configuration if needed
3. Add logging for new functionality
4. Update documentation
5. Test with mock data first

### Testing
```bash
# Run tests
npm test

# Run with debug logging
set LOG_LEVEL=debug&& npm start
```

## Troubleshooting

### Common Issues

**Connector won't start:**
- Check `config.json` exists and is valid
- Verify required configuration fields
- Check logs for specific errors

**API connection failed:**
- Verify `api_url` is correct
- Check `connector_token` is valid
- Ensure network connectivity

**Tally connection failed:**
- Verify Tally is running
- Check Tally API is enabled
- Verify `tally_url` is correct

**Sync failures:**
- Check logs for specific error messages
- Verify payload format matches backend expectations
- Ensure connector token has proper permissions

### Debug Mode
Enable debug logging by setting:
```json
{
  "log_level": "debug"
}
```

## Migration from C# Connector

This Node.js connector is designed to be a drop-in replacement for the C# connector:

### Configuration Compatibility
- Uses same `config.json` format
- Same command-line interface
- Same logging structure

### API Compatibility
- Uses same backend endpoints
- Sends same payload format
- Same authentication method

### Distribution
- Similar ZIP-based distribution
- Same file structure in package
- Compatible with existing download infrastructure

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support, please contact the AI CFO support team or create an issue in the repository.