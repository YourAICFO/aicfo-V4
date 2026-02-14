# AI CFO Connector - Complete Deployment Guide

## Overview

This guide covers the complete deployment of the Node.js-based AI CFO Connector, including backend integration, build process, and distribution setup.

## Architecture Summary

### Components
1. **Node.js Connector** - Windows executable that reads Tally data
2. **Backend API** - Handles authentication, data ingestion, and processing
3. **Distribution System** - ZIP packaging and download delivery

### Data Flow
```
Tally → Node.js Connector → Backend API → Database → Monthly Snapshots
```

## Prerequisites

### Backend Requirements
- Node.js 18+ 
- PostgreSQL 12+
- Redis (optional, for job queue)
- Environment variables configured

### Connector Build Requirements
- Node.js 18+
- pkg package for compilation
- Windows development environment (or cross-compilation setup)

## Step 1: Backend Setup

### Environment Variables
Add these to your backend `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aicfo

# JWT Secret
JWT_SECRET=your-jwt-secret-here

# Connector Configuration
CONNECTOR_TOKEN_SECRET=your-connector-token-secret
CONNECTOR_DOWNLOAD_URL=/download/connector

# CORS
CORS_ORIGIN=https://your-frontend-domain.com

# Optional: Redis for job queue
REDIS_URL=redis://localhost:6379
```

### Database Migrations
Run the connector-related migrations:

```bash
cd backend
npm run migrate
```

This will create the necessary tables:
- `connector_clients`
- `integration_sync_runs`
- `integration_sync_events`
- `ingestion_logs`

### Backend API Routes
The following connector endpoints are now available:

- `POST /api/connector/auth` - Authenticate connector (requires user JWT)
- `POST /api/connector/sync/start` - Start sync run
- `POST /api/connector/sync` - Main data ingestion endpoint
- `POST /api/connector/sync/progress` - Update sync progress
- `POST /api/connector/sync/complete` - Complete sync run
- `POST /api/connector/heartbeat` - Heartbeat signal
- `GET /api/connector/status` - Get sync status (user JWT required)

## Step 2: Build Node.js Connector

### Development Setup
```bash
cd nodejs-connector
npm install
```

### Configuration
Create `config.json` in the nodejs-connector directory:
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

### Build Executable
```bash
npm run build
```

This creates `AICFOConnector.exe` in the root directory.

### Package for Distribution
```bash
npm run build:zip
```

This creates the distribution package in `dist/` folder with:
- `AICFOConnector.exe` - Main executable
- `config.json` - Configuration file
- `run-connector.bat` - Launch script
- `README.txt` - User documentation

## Step 3: Backend Integration Testing

### Test Authentication Flow
1. Get user JWT token from your frontend
2. Register connector:
```bash
curl -X POST https://your-api.com/api/connector/auth \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "your-company-id",
    "deviceId": "test-device-123",
    "deviceName": "Test Connector",
    "os": "Windows 10",
    "appVersion": "1.0.0",
    "userJwt": "your-user-jwt-token"
  }'
```

3. Save the `connectorToken` from response

### Test Heartbeat
```bash
curl -X POST https://your-api.com/api/connector/heartbeat \
  -H "Authorization: Bearer YOUR_CONNECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId": "your-company-id"}'
```

### Test Data Ingestion
```bash
curl -X POST https://your-api.com/api/connector/sync \
  -H "Authorization: Bearer YOUR_CONNECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chartOfAccounts": {
      "source": "tally",
      "generatedAt": "2026-02-10T10:00:00.000Z",
      "groups": [
        {
          "name": "Sundry Debtors",
          "parent": "Current Assets",
          "guid": "group-001",
          "type": "Group"
        }
      ],
      "ledgers": [
        {
          "guid": "ledger-001",
          "name": "ABC Ltd",
          "parent": "Sundry Debtors",
          "groupName": "Sundry Debtors",
          "type": "Ledger"
        }
      ],
      "balances": {
        "current": {
          "monthKey": "2026-02",
          "asOfDate": "2026-02-10",
          "items": [
            {
              "ledgerGuid": "ledger-001",
              "balance": 12345.67
            }
          ]
        },
        "closedMonths": []
      }
    },
    "asOfDate": "2026-02-10"
  }'
```

## Step 4: Distribution Setup

### Upload Distribution Files
1. Build the connector: `npm run build:zip`
2. Upload the generated ZIP to your file server or CDN
3. Update the backend configuration to point to the correct file path

### Download Endpoint
The download endpoint is available at:
```
GET /download/connector
```

This will serve either:
- Node.js connector ZIP (if available in `nodejs-connector/dist/AICFOConnector.zip`)
- Legacy C# executable (fallback)

### Frontend Integration
Update your frontend download link:
```html
<a href="/download/connector" download="AICFOConnector.zip">
  Download AI CFO Connector
</a>
```

## Step 5: Deployment Commands

### Railway Deployment
```bash
# Backend
cd backend
railway login
railway init
railway up

# Set environment variables
railway variables set DATABASE_URL="your-db-url" JWT_SECRET="your-secret"
```

### Vercel Frontend
```bash
cd frontend
vercel --prod
```

### Build and Package Connector
```bash
cd nodejs-connector
npm install
npm run build
npm run build:zip
```

## Step 6: Monitoring and Troubleshooting

### Logs
Connector logs are written to:
- `logs/connector.log` - Main application logs
- `logs/connector-error.log` - Error logs only

### Backend Logs
Check backend logs for:
- Authentication failures
- Data ingestion errors
- Sync run status

### Common Issues

**Connector won't start:**
- Check `config.json` exists and is valid
- Verify connector token is correct
- Check API URL is accessible

**Authentication failed:**
- Verify user JWT is valid during connector registration
- Check connector token hasn't expired (15 minutes)
- Ensure company ID matches

**Data ingestion failed:**
- Verify payload format matches COA contract
- Check ledger balances are non-zero
- Ensure month key format is correct (YYYY-MM)

**Download issues:**
- Verify ZIP file exists in correct location
- Check file permissions
- Ensure proper Content-Type headers

## Step 7: Production Considerations

### Security
- Use HTTPS for all API calls
- Rotate connector tokens regularly
- Store sensitive configuration securely
- Implement rate limiting on connector endpoints

### Performance
- Monitor database performance during bulk inserts
- Implement connection pooling
- Use Redis for job queue in production
- Consider batch processing for large datasets

### Monitoring
- Set up alerts for sync failures
- Monitor connector heartbeat
- Track data ingestion metrics
- Set up log aggregation

### Backup and Recovery
- Regular database backups
- Version control for connector builds
- Disaster recovery procedures
- Data validation and integrity checks

## Maintenance

### Regular Tasks
1. **Weekly**: Check connector download statistics
2. **Monthly**: Review sync success rates
3. **Quarterly**: Update connector dependencies
4. **As needed**: Build and deploy new connector versions

### Updates
- Keep Node.js version updated
- Update dependencies regularly
- Monitor security advisories
- Test updates in staging first

## Support

For issues:
1. Check logs first (connector and backend)
2. Verify configuration
3. Test API endpoints
4. Review error messages
5. Contact support if needed

## Next Steps

1. **Real Tally Integration**: Replace mock data with actual Tally API calls
2. **Company Selection**: Add UI for selecting Tally companies
3. **Advanced Scheduling**: Implement more sophisticated sync scheduling
4. **Performance Optimization**: Add batch processing and optimization
5. **Monitoring Dashboard**: Create connector status dashboard

This completes the full deployment of the AI CFO Node.js connector system.