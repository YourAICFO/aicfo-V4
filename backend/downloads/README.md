# AI CFO Tally Connector - Build Instructions

## Overview
This directory contains the Windows Tally Connector installer that users download to connect their local Tally installation to the AI CFO cloud platform.

## File Structure
```
downloads/
├── AICFOConnectorSetup.exe    # Main connector installer (to be added)
├── README.md                   # This file
└── build-instructions.md       # Detailed build process
```

## Prerequisites for Building Connector

### Development Environment
- Windows 10/11 development machine
- Visual Studio 2019/2022 with .NET Framework 4.7.2+ support
- .NET Framework 4.7.2 Developer Pack
- WiX Toolset (for creating MSI installer)
- Git for Windows

### Required Components
- Tally ERP 9 or TallyPrime (for testing)
- Windows SDK
- Microsoft Visual C++ Redistributable

## Quick Build Process

### 1. Clone and Setup
```bash
# Clone the connector repository (separate repo)
git clone https://github.com/YourAICFO/tally-connector.git
cd tally-connector
```

### 2. Build the Application
```bash
# Open solution in Visual Studio
AICFOConnector.sln

# Or build via command line
msbuild AICFOConnector.sln /p:Configuration=Release /p:Platform="Any CPU"
```

### 3. Create Installer
```bash
# Build the WiX installer project
cd installer/AICFOConnector.Setup
msbuild AICFOConnector.Setup.wixproj /p:Configuration=Release
```

### 4. Output Files
The installer will be created at:
```
installer/AICFOConnector.Setup/bin/Release/AICFOConnectorSetup.exe
```

## Deployment Instructions

### For Development/Testing
1. Copy the built `AICFOConnectorSetup.exe` to this directory
2. Update the version in `backend/src/routes/download.js`
3. Test the download endpoint: `GET /download/connector`

### For Production
1. **Sign the executable** with a valid code signing certificate
2. **Upload to CDN/S3** for better download performance
3. **Update environment variable** `CONNECTOR_DOWNLOAD_URL` if using external hosting
4. **Test on clean Windows systems** to verify dependencies

## Security Considerations

### Code Signing
- **REQUIRED FOR PRODUCTION**: Sign the executable with a trusted certificate
- Prevents Windows SmartScreen warnings
- Builds user trust and credibility
- Required for enterprise deployments

### Distribution
- Host on HTTPS-enabled CDN for faster downloads
- Implement download analytics and monitoring
- Add checksum verification for integrity
- Consider geographic distribution for global users

## Version Management

### Version Format
Use semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes or major features
- MINOR: New features, backward compatible
- PATCH: Bug fixes, security updates

### Update Process
1. Build new version with updated version number
2. Test thoroughly on multiple Windows versions
3. Update version in backend configuration
4. Deploy with proper rollback strategy

## Troubleshooting

### Common Build Issues
1. **Missing .NET Framework**: Install developer pack
2. **WiX Toolset errors**: Ensure proper installation and PATH
3. **Certificate issues**: Use valid code signing certificate
4. **Tally API connectivity**: Test with actual Tally installation

### Testing Checklist
- [ ] Clean Windows installation
- [ ] Different Windows versions (7, 8, 10, 11)
- [ ] Various Tally versions (ERP 9, Prime)
- [ ] Network firewall scenarios
- [ ] User permission levels (Admin/Standard)

## Support and Maintenance

### Monitoring
- Track download success/failure rates
- Monitor user agent and OS versions
- Log installation success metrics
- Monitor for security vulnerabilities

### Updates
- Regular security updates
- Tally API compatibility updates
- Windows compatibility updates
- Feature enhancements based on feedback

## Contact
For build issues or deployment questions:
- Technical Support: support@aicfo.com
- Documentation: https://docs.aicfo.com/connector
- Issues: https://github.com/YourAICFO/tally-connector/issues