# AICFO Windows Connector (.NET Service + MSI)

Production-grade Windows connector for Tally -> AI CFO sync.

## Projects
- `AICFO.Connector.Shared`: common models, secure config/token stores, Tally client, API client.
- `AICFO.Connector.Service`: Windows Service (auto-start capable), heartbeat/sync loops, named-pipe sync-now trigger.
- `AICFO.Connector.Tray`: optional support tray app (configure, sync now, restart service, open logs).
- `installer`: WiX v4 MSI packaging project.

## Runtime paths
- Config: `C:\ProgramData\AICFO\config\config.json`
- Logs: `C:\ProgramData\AICFO\logs\agent.log`
- Token storage: Windows Credential Manager (generic credential key `AICFO_CONNECTOR_TOKEN_<company_id>`)

## Backend contract
Payload strictly follows backend contract in:
- `backend/docs/INTEGRATION_COA_CONTRACT.md`

Service sends:
- `POST /api/connector/heartbeat`
- `GET /api/connector/status/connector`
- `POST /api/connector/sync/start`
- `POST /api/connector/sync`
- `POST /api/connector/sync/complete`

## Build on Windows
Prerequisites:
- .NET SDK 8.0+
- WiX Toolset 4

Commands (PowerShell):
```powershell
cd connector-dotnet
./build.ps1 -Configuration Release
```

Expected MSI output:
- `connector-dotnet/installer/bin/Release/AICFO.Connector.Installer.msi`

After build, rename/copy artifact to backend download location:
- `backend/downloads/AICFOConnectorSetup.msi`

## Service behavior
- Heartbeat every 30 seconds (configurable)
- Scheduled sync every 15 minutes (configurable)
- Manual sync via named pipe (`AICFOConnectorSyncNow`) from tray app
- Exponential backoff with jitter, capped at 10 minutes

## Security
- Raw connector token is never written to logs
- Token stored in Credential Manager
- Config stores only non-secret values (api_url/company_id/intervals)

## Operational checks
1. Install MSI.
2. Verify **AICFO Connector Service** exists and is running in `services.msc`.
3. Open tray app -> Configure -> Save `api_url`, `company_id`, `connector_token`, `tally_port`.
4. Verify logs in `C:\ProgramData\AICFO\logs\agent.log`.
5. Trigger **Sync Now** from tray and confirm backend sync status updates.
