# Connector Build Evidence & Checklist

## PHASE 0 — Canonical Connector (RECON)

**Repo layout (root):**
- `connector-dotnet/` — **canonical** Windows connector (.NET 8)
- `backend/`, `frontend/` — API and web app
- No `nodejs-connector` or `connector` (legacy) at repo root; only `connector-dotnet` contains the solution.

**Solution:** `connector-dotnet/AICFO.Connector.sln`
- **AICFO.Connector.Shared** — models, API client, Tally client, config/token stores
- **AICFO.Connector.Service** — Windows Service (heartbeat/sync)
- **AICFO.Connector.Tray** — **WinForms tray app** (UI; “the app that doesn’t open” = this EXE)
- **installer/AICFO.Connector.Installer.wixproj** — WiX v4 MSI

**Entry type:** Tray = `WinExe`, net8.0-windows, `UseWindowsForms=true`. Service = Worker (Windows Service).

**Build script:** `connector-dotnet/build.ps1` publishes Service + Tray to `publish/service` and `publish/tray`, then builds MSI. Output MSI: `connector-dotnet/out/AICFOConnectorSetup.msi`.

---

## PHASE 1 — Local Build (Commands to run on your machine)

**.NET SDK 8.0+ must be in PATH** (e.g. Developer PowerShell or install from https://dotnet.microsoft.com/download).

```powershell
cd C:\Projects\aicfo-V4\connector-dotnet

dotnet --info
dotnet nuget locals all --clear
dotnet clean
dotnet restore
dotnet build -c Release
```

**Publish Tray only (single EXE for quick test):**
```powershell
dotnet publish AICFO.Connector.Tray\AICFO.Connector.Tray.csproj -c Release -r win-x64 --self-contained true -o .\out\publish /p:PublishSingleFile=true /p:PublishTrimmed=false
```

**Or use the provided script:**
```powershell
.\build-local.ps1 -Configuration Release
```

**Produced EXE:** `connector-dotnet\out\publish\AICFO.Connector.Tray.exe`

**Run from PowerShell:**
```powershell
.\out\publish\AICFO.Connector.Tray.exe
```

If the app is a GUI and produces no console output, check:
- **Bootstrap log:** `%LOCALAPPDATA%\AICFO\Logs\connector.log` (startup and fatal errors)
- **Tray log:** `C:\ProgramData\AICFO\logs\tray.log` or, if that folder is not writable, `%LOCALAPPDATA%\AICFO\Logs\tray.log`

---

## PHASE 2 — Why “installed connector” may not open (diagnosis)

**1. Find installed app**
- Start Menu / Desktop: “AI CFO Connector” or “AICFO Connector”
- Locations:
  - `C:\Program Files\AICFO\` or `C:\Program Files (x86)\AICFO\`
  - `C:\ProgramData\AICFO\` (config/logs; EXE usually in Program Files)
- MSI product:
  ```powershell
  Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*AICFO*" -or $_.Name -like "*Connector*" }
  ```
- Uninstall keys:
  ```powershell
  Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*AICFO*" -or $_.DisplayName -like "*Connector*" }
  ```

**2. Launch from PowerShell (replace path with actual path)**
```powershell
& "C:\Program Files\AICFO\AICFO.Connector.Tray.exe"
```

**3. Common causes**
- **Missing .NET Desktop Runtime 8** — Install: https://dotnet.microsoft.com/download/dotnet/8.0 (Desktop Runtime).
- **x86 vs x64** — Installer and app are x64; running on x86 or wrong shortcut can fail.
- **SmartScreen / “blocked”** — Right‑click EXE → Properties → Unblock.
- **Antivirus** — Check Windows Security → Protection history for quarantined EXE.
- **Config / permissions** — App writes to `C:\ProgramData\AICFO\config` and `logs`. If installer did not set permissions, tray may fail when creating dirs; bootstrap log now falls back to `%LOCALAPPDATA%\AICFO\Logs\connector.log`.
- **No window** — Tray app only shows system-tray icon; double‑click the tray icon to open the control panel.

**4. Event Viewer**
- Windows Logs → Application → filter by time of launch, look for .NET Runtime or Application Error.
- PowerShell:
  ```powershell
  Get-EventLog -LogName Application -Newest 50 | Select TimeGenerated, EntryType, Source, Message
  ```

---

## PHASE 3 — Config & API connectivity

**Config file:** `C:\ProgramData\AICFO\config\config.json`  
**Default backend (new config):** `http://localhost:5000` (set in code).

**Backend connector routes:** `backend/src/routes/connector.js`  
- Device login, companies, links, register-device, status, heartbeat, sync/start, sync, sync/complete.

**Test backend (with backend running on port 5000):**
```powershell
curl http://localhost:5000/health
# If connector health exists:
curl http://localhost:5000/api/connector/health
```

**End-to-end:** In Connector Control Panel set API URL to `http://localhost:5000`, then use “Test Backend” or device login. Check backend logs and DB tables: `connector_clients`, `connector_devices`, `connector_company_links`, `integration_sync_runs`, `integration_sync_events`.

---

## PHASE 4 — MSI build

```powershell
cd C:\Projects\aicfo-V4\connector-dotnet
powershell -ExecutionPolicy Bypass -File .\build.ps1 -Configuration Release
```

**Expected MSI:** `connector-dotnet\out\AICFOConnectorSetup.msi` (and under `installer\bin\Release\`).

**Verbose install log (if install fails):**
```cmd
msiexec /i AICFOConnectorSetup.msi /l*v %TEMP%\aicfo-connector-install.log
```

---

## Fixes applied (code)

1. **Default `api_url`** — `ConnectorConfig.ApiUrl` default set to `http://localhost:5000` so new configs point to local backend.
2. **Bootstrap logging** — First line in Tray `Main()` writes to `%LOCALAPPDATA%\AICFO\Logs\connector.log`; fatal exceptions are appended there so “app doesn’t open” leaves evidence.
3. **Log directory fallback** — If `C:\ProgramData\AICFO\logs` is not writable (e.g. permissions), tray falls back to `%LOCALAPPDATA%\AICFO\Logs` for `tray.log`.
4. **ConnectorPaths** — Added `UserLogsDirectory` and `BootstrapLogFile` for user-writable bootstrap log path.

**Files changed:**
- `AICFO.Connector.Shared/Models/ConnectorConfig.cs` — default `ApiUrl = "http://localhost:5000"`.
- `AICFO.Connector.Shared/Services/ConnectorPaths.cs` — `UserLogsDirectory`, `BootstrapLogFile`.
- `AICFO.Connector.Tray/Program.cs` — bootstrap log, try/catch around ProgramData log dir, fallback log dir, fatal exception logging to bootstrap log.

---

## Remaining TODOs

| Priority | Issue | Notes |
|----------|------|------|
| P0 | Run build on your machine | `dotnet` was not in PATH in the automation environment; run `build-local.ps1` or the publish commands above locally. |
| P1 | Confirm installed EXE path and shortcut | After locating the installed Tray EXE, verify the Start Menu shortcut target and “Start in” folder. |
| P2 | Event Viewer / bootstrap log | If the app still doesn’t open, check `%LOCALAPPDATA%\AICFO\Logs\connector.log` and Application event log for the exact error. |
| P2 | MSI permissions | Ensure MSI creates `C:\ProgramData\AICFO` with permissions so the tray (running as user) can create config/logs if missing. |

---

## Evidence checklist (you fill after running)

- [ ] `dotnet --info` output (paste or attach)
- [ ] `dotnet build -c Release` and `dotnet publish ...` output
- [ ] Path to EXE: `_________________________`
- [ ] Running `.\out\publish\AICFO.Connector.Tray.exe`: window / tray icon appeared? Y/N
- [ ] Content of `%LOCALAPPDATA%\AICFO\Logs\connector.log` (if any) after one run
- [ ] Backend `curl http://localhost:5000/health` response
- [ ] If MSI built: path to `AICFOConnectorSetup.msi` and install log path if install failed
