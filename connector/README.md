# AI CFO Tally Connector

## Overview

The Tally Connector is a lightweight Windows application that runs locally on the user's machine, connects to their Tally installation, and securely transmits financial data to the AI CFO cloud platform.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Tally ERP 9   │────▶│  Tally Connector │────▶│  AI CFO Cloud   │
│  (localhost)    │     │  (Local Agent)   │     │   (Railway)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Key Features

### 1. Local Data Access
- Connects directly to Tally API on localhost
- No firewall configuration required
- Works with Tally ERP 9, TallyPrime, Tally 6/7/8/9

### 2. Secure Data Transmission
- Short-lived authentication tokens
- HTTPS encrypted communication
- Local data never stored permanently

### 3. Simple User Interface
- System tray application
- Status indicators (Connected/Syncing/Last sync/Errors)
- One-click sync functionality

### 4. Configurable Connection
- Auto-detect Tally port (not hardcoded 9000)
- Manual port configuration if needed
- Multiple Tally company support

## Installation

### System Requirements
- Windows 7 or later
- .NET Framework 4.7.2 or later
- Tally ERP 9/Prime with Tally API enabled

### Quick Install
1. Download `AICFOConnectorSetup.exe`
2. Run installer as Administrator
3. Enter AI CFO credentials
4. Click "Connect to Tally"

## Configuration

### Automatic Setup
The connector will attempt to:
1. Detect Tally installation path
2. Find active Tally API port
3. List available companies
4. Test connection automatically

### Manual Configuration
If auto-detection fails:
1. Enter Tally server URL (e.g., http://localhost:9000)
2. Select company from dropdown
3. Test connection manually

## User Interface

### System Tray Icon
- 🟢 Green: Connected and ready
- 🟡 Yellow: Syncing data
- 🔴 Red: Connection error
- ⚪ Gray: Disconnected

### Status Window
```
┌─────────────────────────────────┐
│ AI CFO Tally Connector          │
├─────────────────────────────────┤
│ Status: Connected               │
│ Company: ABC Enterprises        │
│ Last Sync: 2 minutes ago        │
│                                 │
│ [Sync Now] [Settings] [Help]    │
└─────────────────────────────────┘
```

## Data Flow

### 1. Connection Phase
```
Connector → Tally Health Check → Company List → Authentication
```

### 2. Data Discovery
```
Company Selection → Available Reports → Data Preview → User Confirmation
```

### 3. Sync Process
```
Raw Data Fetch → Local Validation → Secure Upload → Cloud Processing
```

### 4. Status Updates
```
Progress Updates → Completion Status → Error Handling → Retry Logic
```

## Security

### Authentication
- Short-lived JWT tokens (15-minute expiry)
- Refresh token rotation
- Secure token storage in Windows Credential Manager

### Data Protection
- HTTPS-only communication
- Data encrypted in transit
- No permanent local data storage
- Automatic cleanup of temporary files

### Access Control
- User must explicitly authorize each sync
- Granular permissions (read-only from Tally)
- Audit logging of all operations

## Troubleshooting

### Common Issues

#### "Cannot connect to Tally"
**Solution:**
1. Ensure Tally is running
2. Enable Tally API (F12 → Advanced Configuration → Tally API)
3. Check firewall settings
4. Verify correct port number

#### "No companies found"
**Solution:**
1. Check if companies are loaded in Tally
2. Verify company names don't contain special characters
3. Ensure proper Tally user permissions

#### "Sync failed"
**Solution:**
1. Check internet connectivity
2. Verify AI CFO credentials
3. Review error details in logs
4. Try manual sync with smaller date range

### Logs Location
```
%APPDATA%\AICFO\Connector\logs\
```

## Development

### Building from Source
```bash
# Clone repository
git clone https://github.com/YourAICFO/tally-connector.git

# Open in Visual Studio
AICFOConnector.sln

# Build solution
Ctrl+Shift+B
```

### Project Structure
```
connector/
├── src/
│   ├── AICFOConnector/          # Main application
│   ├── AICFOConnector.Core/     # Business logic
│   ├── AICFOConnector.UI/       # User interface
│   └── AICFOConnector.Tests/    # Unit tests
├── installer/
│   └── AICFOConnector.Setup/    # Windows installer
└── docs/
    ├── user-guide.md
    └── developer-guide.md
```

## Support

- **Documentation**: [docs.user-guide.md](docs/user-guide.md)
- **Issues**: https://github.com/YourAICFO/tally-connector/issues
- **Email**: support@aicfo.com
- **Phone**: +91-XXXXXXXXXX

## License

Proprietary - AI CFO Platform