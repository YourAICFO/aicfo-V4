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
- Token storage: Windows Credential Manager (generic credential keys `AICFO_CONNECTOR_TOKEN_MAPPING_<mapping_id>`)

## Advanced config (optional)
`config.json` supports:
- `historical_months_to_sync` (default `24`)
- `tally_request_timeout_seconds` (default `30`)
- `tally_request_max_retries` (default `3`)
- `max_ledger_count_warning` (default `50000`)

## Backend contract
Payload strictly follows backend contract in:
- `backend/docs/INTEGRATION_COA_CONTRACT.md`

Service sends:
- `POST /api/connector/heartbeat`
- `GET /api/connector/status/connector`
- `POST /api/connector/sync/start`
- `POST /api/connector/sync`
- `POST /api/connector/sync/complete`

Payload includes:
- `chartOfAccounts.groups`, `chartOfAccounts.ledgers`
- `balances.current`
- `balances.closedMonths` (last `historical_months_to_sync` closed months; default 24)
- optional `partyBalances`, `loans`, `interestSummary`, `metadata.missingMonths`

## Connector Control Panel (multi-company mapping)
Open **AI CFO Connector** from desktop/start menu/tray icon.

Tabs:
- **Status**
  - Shows backend reachability, Tally reachability, last heartbeat, last sync, last result, last error.
  - Actions: `Test Backend`, `Detect Tally`, `Test Tally`, `Sync Now`, `Sync All`, `Open Logs`.
- **Company Mapping**
  - Detect Tally companies from configured host/port.
  - Link mapping by pasting:
    - `company_id`
    - `connector_token`
    - selecting a Tally company name
  - View current mappings and trigger per-mapping sync or remove mapping.

Manual linking is used for MVP. One connector install can manage multiple mappings.

## Build on Windows
Prerequisites:
- .NET SDK 8.0+
- WiX Toolset 4

Commands (PowerShell):
```powershell
cd connector-dotnet
./build.ps1 -Configuration Release
```

Expected MSI output name:
- `AICFOConnectorSetup.msi`

Typical output path:
- `connector-dotnet/installer/bin/Release/**/AICFOConnectorSetup.msi`

After build, rename/copy artifact to backend download location:
- `backend/downloads/AICFOConnectorSetup.msi`

### Install troubleshooting (install log)
If the MSI fails to install or the UI does not open, capture a verbose log:

```cmd
msiexec /i AICFOConnectorSetup.msi /l*v %TEMP%\aicfo-connector-install.log
```

Then open `%TEMP%\aicfo-connector-install.log` to see the reason for failure (e.g. permissions, service start, missing dependencies). Run the command from an elevated Command Prompt if you see access-denied errors.

## Service behavior
- Heartbeat every 30 seconds per mapping (configurable)
- Scheduled sync every 15 minutes per mapping (configurable)
- Manual sync via named pipe (`AICFOConnectorSyncNow`) from tray app
- Exponential backoff with jitter, capped at 10 minutes
- If one or more historical months fail to fetch, sync completes as `partial`

## Security
- Raw connector token is never written to logs
- Token stored in Credential Manager
- Config stores only non-secret values (api_url/company_id/intervals)

## Operational checks
1. Install MSI.
2. Verify **AICFO Connector Service** exists and is running in `services.msc`.
3. Open **AI CFO Connector Control Panel** from desktop/start menu.
4. In **Status** tab save `api_url`, `tally_host`, `tally_port`, heartbeat/sync intervals.
5. In **Company Mapping** tab click **Detect Tally Companies**.
6. Paste `company_id` + `connector_token`, select Tally company, click **Link Mapping**.
7. Verify mapping appears in current mappings list.
8. Trigger **Sync Selected** or **Sync All** and confirm backend sync status updates.
9. Verify logs in `C:\ProgramData\AICFO\logs\agent.log`.

## How to verify (connector stability)

1. **Config clean start**  
   Delete the ProgramData config file (`C:\ProgramData\AICFO\config\config.json`), then launch the tray. It should start with defaults and create a new valid `config.json`.

2. **Corrupt config (null byte)**  
   - Close the tray.  
   - Open `config.json` in a binary/hex editor and insert a `0x00` at the start (or overwrite part of the file with nulls).  
   - Save and launch the tray.  
   - Tray should start without crashing; you should see an orange banner: “Config was corrupt and has been reset; see logs.”  
   - The corrupt file should be renamed to `config.json.bad-<yyyyMMdd-HHmmss>` in the same folder.

3. **Discovery URL**  
   - From a command line:  
     `curl -i -H "Accept: application/json" -H "User-Agent: AICFOConnector/1.0" "https://aicfo.in/.well-known/aicfo-connector.json"`  
     (Or use the tray’s discovery/diagnostics if available.)  
   - Connector uses GET, `Accept: application/json`, `User-Agent: AICFOConnector/<version>`, and follows redirects.  
   - On non-200 or invalid JSON, the connector logs safe diagnostics (status code + first 300 chars of response); it does not crash and keeps the fallback API URL.
