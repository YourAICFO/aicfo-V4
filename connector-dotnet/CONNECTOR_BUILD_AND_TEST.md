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

**Test backend (with backend running on port 5000):** On Windows use `127.0.0.1` to avoid IPv6 connection refused.
```powershell
curl http://127.0.0.1:5000/health
# If connector health exists:
curl http://127.0.0.1:5000/api/connector/health
```

**End-to-end:** In Connector Control Panel set API URL to `http://127.0.0.1:5000`, then use “Test Backend” or device login. Check backend logs and DB tables: `connector_clients`, `connector_devices`, `connector_company_links`, `integration_sync_runs`, `integration_sync_events`.

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

## Local Tray Verification (Automated)

One-command local check that the Tray build runs and the process stays alive after launch.

**Command (run from connector-dotnet):**
```powershell
cd C:\Projects\aicfo-V4\connector-dotnet
.\verify-tray.ps1
```

**What it does:**
- Resolves `dotnet` (PATH, where.exe, ProgramFiles, ProgramFiles(x86)); prints DOTNET EXE and PATH contains dotnet
- Builds the **Tray project** only (Release; avoids installer/WiX), publishes Tray to `out\publish`
- Starts `AICFO.Connector.Tray.exe` in the background, waits 3 seconds
- Verifies the process is still running
- Prints the last 50 lines of the bootstrap log (`%LOCALAPPDATA%\AICFO\Logs\connector.log`) if it exists
- Exits 0 if the tray process is alive; non-zero otherwise with diagnostics

**Logs:**
- Bootstrap: `$env:LOCALAPPDATA\AICFO\Logs\connector.log` (startup and fatal errors)
- Tray log: `C:\ProgramData\AICFO\logs\tray.log` or `%LOCALAPPDATA%\AICFO\Logs\tray.log` if ProgramData is not writable

**Stop the Tray process after verification:**
```powershell
Stop-Process -Name "AICFO.Connector.Tray" -Force
```

**Sample expected output (success):**
```
dotnet --version
8.0.x
Building solution (Release)...
...
Publishing Tray (win-x64, self-contained) to ...\out\publish...
...
Starting Tray in background...
Waiting 3 seconds...
SUCCESS: Tray process is running (PID(s): 12345)
Bootstrap log location: C:\Users\...\AppData\Local\AICFO\Logs\connector.log
Bootstrap log (last 50 lines):
... Tray starting at ...
Verification passed. To stop the Tray process: Stop-Process -Name 'AICFO.Connector.Tray' -Force
```

---

### Evidence

**Commands run:**
```powershell
cd C:\Projects\aicfo-V4\connector-dotnet
Get-Command dotnet | Format-List
where.exe dotnet
.\verify-tray.ps1
```

**Step 2 — Get-Command dotnet | Format-List** (run in same session where dotnet was not in PATH):
```text
Get-Command : The term 'dotnet' is not recognized as the name of a cmdlet, function, script file, or operable program.
Check the spelling of the name, or if a path was included, verify that it was correct.
At line 1 char:55
+ Get-Command dotnet | Format-List
+ ~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : CommandNotFoundException
    + FullyQualifiedId       : CommandNotFoundException
```

**Step 3 — where.exe dotnet:**
```text
INFO: Could not find files for the given pattern(s).
```

**Step 4 — .\verify-tray.ps1 (full console output):**
```text
DOTNET EXE: C:\Program Files\dotnet\dotnet.exe
PATH contains dotnet: False
dotnet --version
10.0.103
Stopping existing Tray process(es)...
Building Tray project (Release)...
  Determining projects to restore...
C:\Projects\aicfo-V4\connector-dotnet\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj : warning NU1701: Package 'CredentialManagement 1.0.2' was restored using ...
  All projects are up-to-date for restore.
  AICFO.Connector.Shared -> ...\AICFO.Connector.Shared.dll
  AICFO.Connector.Tray -> ...\AICFO.Connector.Tray\bin\Release\net8.0-windows\win-x64\AICFO.Connector.Tray.dll

Build succeeded.
    4 Warning(s)
    0 Error(s)

Time Elapsed 00:00:02.14
Publishing Tray (win-x64, self-contained) to C:\Projects\aicfo-V4\connector-dotnet\out\publish...
  AICFO.Connector.Shared -> ...\AICFO.Connector.Shared.dll
  AICFO.Connector.Tray -> ...\AICFO.Connector.Tray\bin\Release\net8.0-windows\win-x64\AICFO.Connector.Tray.dll
  AICFO.Connector.Tray -> C:\Projects\aicfo-V4\connector-dotnet\out\publish\

Starting Tray in background...
Waiting 3 seconds...
SUCCESS: Tray process is running (PID(s): 18060)
Bootstrap log location: C:\Users\AB COM\AppData\Local\AICFO\Logs\connector.log
Bootstrap log (last 50 lines):
2026-02-22T11:51:16.5931241Z Tray starting at 2026-02-22T11:51:16.5823150Z
2026-02-22T11:51:16.8246362Z Fatal: System.NullReferenceException: Object reference not set to an instance of an object.
   at System.Drawing.Font..ctor(Font prototype, FontStyle newStyle)
   at AICFO.Connector.Tray.ConnectorControlPanel..ctor(IConfigStore configStore, ICredentialStore credentialStore, ISyncNowTriggerClient syncNowTriggerClient, IAicfoApiClient apiClient, ITallyXmlClient tallyClient) in C:\Projects\aicfo-V4\connector-dotnet\AICFO.Connector.Tray\Program.cs:line 246
   at AICFO.Connector.Tray.TrayApplicationContext..ctor(IConfigStore configStore, ICredentialStore credentialStore, ISyncNowTriggerClient syncNowTriggerClient, IAicfoApiClient apiClient, ITallyXmlClient tallyClient) in C:\Projects\aicfo-V4\connector-dotnet\AICFO.Connector.Tray\Program.cs:line 82
   at AICFO.Connector.Tray.Program.Main() in C:\Projects\aicfo-V4\connector-dotnet\AICFO.Connector.Tray\Program.cs:line 40
2026-02-22T12:08:52.7069600Z Tray starting at 2026-02-22T12:08:52.6951470Z
2026-02-22T12:12:32.6803509Z Tray starting at 2026-02-22T12:12:32.6714098Z

Verification passed. To stop the Tray process: Stop-Process -Name 'AICFO.Connector.Tray' -Force
```

**Final: PASS.**  
- **Why PASS:** `.\verify-tray.ps1` exited with code 0. Dotnet was resolved from `C:\Program Files\dotnet\dotnet.exe` (PATH did not contain dotnet). Tray project built and published successfully. The Tray process was running (PID 18060) after 3 seconds. The bootstrap log shows the latest run at `2026-02-22T12:12:32` with "Tray starting at" and **no** "Fatal:" line after it; the Fatal at 11:51 is from an earlier run before the SafeFontForStyle fix. The script builds the Tray project only (not the full solution) to avoid installer/WiX HEAT errors.

---

## Local E2E Test (Backend + Tray)

End-to-end proof: backend reachable, tray built and running, config points to the API URL, connector dev routes and authenticated calls exercised.

**Prerequisites:**
- Backend running at `http://127.0.0.1:5000` (e.g. `cd backend; npm run dev`). Use `127.0.0.1` (not `localhost`) on Windows to avoid IPv6 connection refused when Express binds to IPv4.
- `NODE_ENV=development` so dev-only routes (`/api/connector/dev/create-device`, `/api/connector/dev/devices`) are enabled.
- At least one company in the database (for create-device).

**Command:**
```powershell
cd C:\Projects\aicfo-V4\connector-dotnet
.\e2e-local.ps1
```

**PASTE OUTPUT HERE**

```text

```

---

## Evidence checklist (you fill after running)

- [ ] `dotnet --info` output (paste or attach)
- [ ] `dotnet build -c Release` and `dotnet publish ...` output
- [ ] Path to EXE: `_________________________`
- [ ] Running `.\out\publish\AICFO.Connector.Tray.exe`: window / tray icon appeared? Y/N
- [ ] Content of `%LOCALAPPDATA%\AICFO\Logs\connector.log` (if any) after one run
- [ ] Backend `curl http://127.0.0.1:5000/health` response
- [ ] If MSI built: path to `AICFOConnectorSetup.msi` and install log path if install failed
