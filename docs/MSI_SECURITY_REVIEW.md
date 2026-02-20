# MSI Connector Security Review (Enterprise / Microsoft Style)

This document is a security review of the **Windows MSI connector** (connector-dotnet + WiX installer). It covers what is installed, permissions, persistence, network behavior, secrets, logging, updates, uninstall, code signing, and SmartScreen. Node.js connector packaging is noted where applicable.

---

## 1) What is installed (files, folders, services, registry)

| Artifact | Location / Details |
|----------|---------------------|
| **Binaries** | `%ProgramFiles%\AICFOConnector\Service\` (service exe + dependencies), `%ProgramFiles%\AICFOConnector\Tray\` (tray exe + dependencies). Built as single-file, self-contained (win-x64). |
| **Config** | `%ProgramData%\AICFO\config\` — created by installer and at runtime. Contains `config.json` (no secrets; tokens are in Credential Manager), `device_id.txt` (opaque device GUID). |
| **Logs** | `%ProgramData%\AICFO\logs\` — `agent.log` (service), `tray.log` (tray). Rolling daily, 14 days retained, shared write. |
| **Start Menu** | Shortcut: "AI CFO Connector" → tray exe. |
| **Desktop** | Optional shortcut: "AI CFO Connector" → tray exe. |
| **Registry (per-user)** | `HKCU\Software\AICFO\Connector`: `TrayStartMenuShortcut`, `TrayDesktopShortcut`. Tray auto-start is **not** set by the installer; the tray app adds `HKCU\...\Run\AICFOConnector` only when the user enables “Start with Windows” in config. |
| **Service** | **AICFO Connector Service** — Win32 own process, auto-start, runs as **LocalSystem**. Binary: `AICFO.Connector.Service.exe`. |
| **Scheduled tasks** | None. |
| **Named pipe** | `\\.\pipe\AICFOConnectorSyncNow` — used for tray → service “sync now” trigger. |

**WiX identity:** `Package Name="AI CFO Connector"`, `Manufacturer="AI CFO"`, `Version="1.0.0"`, `UpgradeCode="f72aaf9d-f8cf-49de-b380-89df3af861bf"`. Install path is **Program Files (64-bit)**; upgrade path is correct via `MajorUpgrade`.

---

## 2) Required permissions

| Context | Permission |
|---------|------------|
| **Install** | Administrator (MSI installs to Program Files and installs a LocalSystem service). |
| **Run (service)** | **LocalSystem** — full local machine access. Required to read ProgramData, Credential Manager (LocalComputer), and to open Tally on localhost. See **§ Service account (LocalSystem)** below for why LocalService is not used. |
| **Run (tray)** | Interactive user. Needs read/write to `%ProgramData%\AICFO\config` and `logs`, and read of Credential Manager entries created by the same user or by the service (service uses LocalComputer credentials). |
| **Firewall** | Outbound HTTPS to the configured API base URL (e.g. `https://api.aicfo.com` or custom). Outbound HTTP to `TallyHost:TallyPort` (default `127.0.0.1:9000`) for Tally. No inbound firewall rules. |
| **Credential Manager** | Service and tray store secrets under Windows Credential Manager (Generic / LocalComputer). No DPAPI used directly; Credential Manager uses system protection. |

---

## 3) Persistence behavior

| Mechanism | Behavior |
|-----------|----------|
| **Service** | `Start="auto"` — starts at boot. `ServiceControl Start="install"` — started after install. |
| **Tray auto-start** | **Disabled by default.** The installer does not set the Run key. The tray app adds `HKCU\...\Run\AICFOConnector` only when the user enables “Start with Windows” in settings (config `start_with_windows`). Enterprise can leave this off. |
| **No scheduled task** | Sync is timer-based inside the service (e.g. every 15 minutes) and on-demand via pipe. |

---

## 4) Network behavior

| Destination | Protocol / Port | Purpose |
|-------------|-----------------|---------|
| **API base URL** (from `config.json` `api_url`) | HTTPS (443 typical). Built with .NET `HttpClient` — default TLS validation (no custom `ServerCertificateCustomValidationCallback`). | Login, heartbeat, sync start/payload/complete, status, device/links. |
| **Tally** (`tally_host` / `tally_port`, default `127.0.0.1:9000`) | HTTP (no TLS). Tally ERP typically exposes XML on localhost. | Fetch companies, groups, ledgers, balances. |

**TLS:** Default .NET certificate validation; no bypass. Retries: configurable `tally_request_max_retries` (default 3); API calls use normal `HttpClient` retry only if not customized.

**Domains:** Only the host derived from `config.json` `api_url` and `tally_host` (usually localhost). No hardcoded alternate URLs or telemetry endpoints.

---

**Service account (LocalSystem vs LocalService):**

The connector service runs as **LocalSystem** (not LocalService). Reasons:

- **Credential Manager:** Tokens are stored in Windows Credential Manager with `PersistanceType.LocalComputer`. LocalSystem can read these; LocalService typically cannot access machine-level credentials in the same way without additional configuration.
- **ProgramData:** The service reads/writes `%ProgramData%\AICFO\config` and `logs`. LocalSystem has access; LocalService would require explicit ACLs on that directory.
- **Tally on localhost:** Tally ERP often runs as the logged-in user or a system account; LocalSystem can connect to `127.0.0.1:9000` without extra permission setup.

Switching to **LocalService** would require: (1) Storing credentials in a store accessible to LocalService (e.g. a dedicated store or file with restricted ACLs), (2) Granting LocalService read/write to `%ProgramData%\AICFO`, and (3) Verifying Tally connectivity. For enterprise “least privilege” hardening, this can be revisited with proper testing; the current choice prioritizes compatibility and simplicity.

---

## 5) Secret handling

| Secret | Storage | Risk |
|--------|---------|------|
| **Connector / mapping / device auth tokens** | **Windows Credential Manager** (Generic, LocalComputer), target names prefixed `AICFO_CONNECTOR_TOKEN_`. Not in config file. | Low — Credential Manager is the recommended store; not plaintext on disk. |
| **Passwords (login)** | Sent to API over HTTPS; not persisted. Optional “Remember me” stores only the **device auth token** in Credential Manager. | Low. |
| **config.json** | Contains `api_url`, `tally_host`, `tally_port`, mappings (company ids, tally names, link ids, last error text). **No tokens.** | Low. |
| **device_id.txt** | Opaque GUID; not a secret. | N/A. |

**Plaintext risks:** None in the MSI connector for tokens. The **Node.js connector** packaging script (`nodejs-connector/scripts/package.js`) generates a sample `config.json` with placeholder `connector_token: 'your-connector-token'`; if users replace with a real token, that would be plaintext. Recommendation: do not store production tokens in config for the Node pack; use env or a secure store.

---

## 6) Logging (locations, rotation, PII/secrets redaction)

| Log | Location | Rotation | Content risk |
|-----|----------|----------|--------------|
| **agent.log** | `%ProgramData%\AICFO\logs\agent.log` | Rolling daily, 14 files retained, shared write | May contain mapping ids, paths, exception messages. **Fix applied:** API failure response bodies are redacted before logging to avoid token leakage. |
| **tray.log** | `%ProgramData%\AICFO\logs\tray.log` | Same | Same. |
| **Copy Login Diagnostics** (Tray) | Copies to clipboard: endpoint path, status code, response body (truncated). **Fix applied:** Response body is redacted for token/password fields before copy. | N/A | Was possible to copy error response containing tokens; now redacted. |

**Recommendation:** Avoid logging full request/response bodies; log status codes and redacted summaries only.

---

## 7) Update mechanism

- **No in-app updater.** Updates are done by installing a new MSI.
- **MajorUpgrade** in WiX handles upgrade/downgrade (same `UpgradeCode`); newer version replaces older.
- No download of executable code from the internet by the connector; only API data exchange.

---

## 8) Uninstall behavior

| Item | Removed on uninstall? |
|------|------------------------|
| **Program Files binaries** (Service, Tray) | Yes. |
| **Start Menu shortcut** | Yes (`RemoveFolder` on uninstall). |
| **Desktop shortcut** | Yes (component removed). |
| **Run key** | The installer does not set a Run key. If the user enabled “Start with Windows”, the tray added `HKCU\...\Run\AICFOConnector`; the MSI does not remove it (no component). For full cleanup, see **Purge instructions** below. |
| **Service** | Yes (`ServiceControl Remove="uninstall"`). |
| **ProgramData** `%ProgramData%\AICFO\config` and `logs` | **No.** Left by design so user config and logs survive reinstall. |
| **Credential Manager entries** | **No.** Must be removed manually if desired. |

**Purge instructions (full cleanup after uninstall):**

1. **ProgramData:** Delete folder `%ProgramData%\AICFO` (config and logs). From PowerShell: `Remove-Item -Recurse -Force $env:ProgramData\AICFO -ErrorAction SilentlyContinue`
2. **Run key (if tray was set to start with Windows):** Remove `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` value `AICFOConnector`. From PowerShell: `Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'AICFOConnector' -ErrorAction SilentlyContinue`
3. **Credential Manager:** Open Windows Credential Manager → Windows Credentials → remove any entry whose name starts with `AICFO_CONNECTOR_TOKEN_`. From PowerShell (requires `CredentialManager` module or manual UI): use Control Panel or `cmdkey /delete:TargetName` for each target.

---

## 9) Code signing status

| Item | Current state | Recommendation |
|------|----------------|----------------|
| **MSI** | Signed in CI when secrets provided; otherwise unsigned. | Use a valid code-signing certificate (standard or EV). |
| **Binaries** (.exe) | Same as above. | Sign Service and Tray exes before MSI. |
| **CI/CD (GitHub Actions)** | Workflow signs when `CODESIGN_PFX_BASE64` and `CODESIGN_PFX_PASSWORD` are set; otherwise builds unsigned and uploads as-is. | Add secrets for release builds. |
| **Local signing** | See below. | Use signtool with PFX; always use timestamping. |

**Signing with signtool (no secrets committed):**

- **signtool** is in the Windows SDK: `C:\Program Files (x86)\Windows Kits\10\bin\<arch>\signtool.exe` (e.g. `x64` for 64-bit). On GitHub Actions `windows-latest` it is available via the SDK.
- **Timestamping** is required so signatures remain valid after the cert expires. Use an RFC 3161 timestamp server, e.g.:
  - DigiCert: `http://timestamp.digicert.com`
  - Sectigo: `http://timestamp.sectigo.com`
- **Sign exes first, then the MSI.** Order: Service exe → Tray exe → MSI.

**Local signing (no cert in repo):**

1. Export your PFX (e.g. from CA or Key Vault). Do not commit the PFX or password.
2. Sign each binary with timestamping:
   ```cmd
   signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /f MyCert.pfx /p <password> connector-dotnet\publish\service\AICFO.Connector.Service.exe
   signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /f MyCert.pfx /p <password> connector-dotnet\publish\tray\AICFO.Connector.Tray.exe
   ```
3. Build the MSI (so it contains the signed exes), then sign the MSI:
   ```cmd
   signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /f MyCert.pfx /p <password> connector-dotnet\installer\bin\Release\AICFOConnectorSetup.msi
   ```
4. Verify (see **Security Checklist for Release**).

**CI (GitHub Actions):** When repository secrets are set, the workflow signs automatically. **Do not commit the PFX or password.**

- **Secrets:** `CODESIGN_PFX_BASE64` (entire PFX file encoded as base64), `CODESIGN_PFX_PASSWORD` (PFX password).
- To produce base64: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("MyCert.pfx"))` (PowerShell).
- If either secret is missing, the build runs but skips signing and uploads the unsigned MSI.

---

## 10) SmartScreen considerations

- **Unsigned binaries:** SmartScreen will show “Unknown publisher” and may block or warn. Signing with a valid code-signing cert reduces this.
- **EV certificate:** Builds reputation faster and can reduce SmartScreen warnings sooner than standard certs.
- **Reputation:** New or rarely downloaded files need time to build reputation even when signed; EV helps.
- **Installer metadata:** WiX sets `Manufacturer="AI CFO"` and product name; ensure these match your brand and cert publisher name where appropriate.

---

## WiX: Manufacturer / ProductName / UpgradeCode

- **Package Name:** `"AI CFO Connector"` (product name).
- **Manufacturer:** `"AI CFO"`.
- **Version:** `1.0.0` (bump for each release; MajorUpgrade uses this).
- **UpgradeCode:** `f72aaf9d-f8cf-49de-b380-89df3af861bf` — **stable;** do not change for the product line. Same UpgradeCode ensures upgrades/reinstalls are detected.
- **Install path:** `ProgramFiles64Folder` → `AICFOConnector\Service` and `AICFOConnector\Tray` (correct for per-machine install).

---

## Security Checklist for Release

- [ ] **Secrets:** No tokens in config files; tokens only in Credential Manager (done).
- [ ] **Logging:** No unredacted tokens or passwords in logs or “Copy diagnostics” (redaction applied).
- [ ] **TLS:** No custom certificate validation; use default HTTPS (done).
- [ ] **Updates:** No in-app download of code (done); updates via MSI only.
- [ ] **Install path:** Program Files, stable UpgradeCode (done).
- [ ] **Uninstall:** Service removed; Run key not set by installer (tray manages it if user enables). ProgramData and Credential Manager purge instructions in §8.
- [ ] **Code signing:** Sign all binaries and MSI before release (signtool + timestamping; CI can sign when secrets are set).
- [ ] **Permissions:** Document LocalSystem and admin install (done in this doc).
- [ ] **Node.js connector:** If shipping, avoid storing production tokens in config; document secure configuration.

**Signing verification (before release):**

1. **signtool verify** (all signatures, including timestamp):
   ```cmd
   signtool verify /pa /v "connector-dotnet\publish\service\AICFO.Connector.Service.exe"
   signtool verify /pa /v "connector-dotnet\publish\tray\AICFO.Connector.Tray.exe"
   signtool verify /pa /v "connector-dotnet\installer\bin\Release\AICFOConnectorSetup.msi"
   ```
   `/pa` verifies the authenticode signature; `/v` is verbose. Exit code 0 means valid.

2. **PowerShell Get-AuthenticodeSignature:**
   ```powershell
   Get-AuthenticodeSignature -FilePath "connector-dotnet\publish\service\AICFO.Connector.Service.exe" | Format-List *
   Get-AuthenticodeSignature -FilePath "connector-dotnet\installer\bin\Release\AICFOConnectorSetup.msi" | Format-List *
   ```
   Check `Status -eq 'Valid'`, `SignerCertificate` is not null, and `TimeStamperCertificate` is present (timestamp applied).

---

*Document version: 1.1. Release-ready: signing docs, CI signing, tray autostart optional, purge instructions, verification steps.*
