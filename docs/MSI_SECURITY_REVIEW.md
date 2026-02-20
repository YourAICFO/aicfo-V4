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
| **Registry (per-user)** | `HKCU\Software\AICFO\Connector`: `TrayStartMenuShortcut`, `TrayDesktopShortcut`, `TrayAutoStart`. `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`: `AICFOConnectorTray` = path to tray exe (auto-start). |
| **Service** | **AICFO Connector Service** — Win32 own process, auto-start, runs as **LocalSystem**. Binary: `AICFO.Connector.Service.exe`. |
| **Scheduled tasks** | None. |
| **Named pipe** | `\\.\pipe\AICFOConnectorSyncNow` — used for tray → service “sync now” trigger. |

**WiX identity:** `Package Name="AI CFO Connector"`, `Manufacturer="AI CFO"`, `Version="1.0.0"`, `UpgradeCode="f72aaf9d-f8cf-49de-b380-89df3af861bf"`. Install path is **Program Files (64-bit)**; upgrade path is correct via `MajorUpgrade`.

---

## 2) Required permissions

| Context | Permission |
|---------|------------|
| **Install** | Administrator (MSI installs to Program Files and installs a LocalSystem service). |
| **Run (service)** | **LocalSystem** — full local machine access. Required to read ProgramData, Credential Manager (LocalComputer), and to open Tally on localhost. |
| **Run (tray)** | Interactive user. Needs read/write to `%ProgramData%\AICFO\config` and `logs`, and read of Credential Manager entries created by the same user or by the service (service uses LocalComputer credentials). |
| **Firewall** | Outbound HTTPS to the configured API base URL (e.g. `https://api.aicfo.com` or custom). Outbound HTTP to `TallyHost:TallyPort` (default `127.0.0.1:9000`) for Tally. No inbound firewall rules. |
| **Credential Manager** | Service and tray store secrets under Windows Credential Manager (Generic / LocalComputer). No DPAPI used directly; Credential Manager uses system protection. |

---

## 3) Persistence behavior

| Mechanism | Behavior |
|-----------|----------|
| **Service** | `Start="auto"` — starts at boot. `ServiceControl Start="install"` — started after install. |
| **Tray auto-start** | Optional: Run key `AICFOConnectorTray` set by installer. User can disable by removing shortcut or Run entry. |
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
| **Run key** `AICFOConnectorTray` | Yes (component `ConnectorTrayAutoStartRunKey` removed). |
| **Service** | Yes (`ServiceControl Remove="uninstall"`). |
| **ProgramData** `%ProgramData%\AICFO\config` and `logs` | **No.** Left by design so user config and logs survive reinstall. For full cleanup, delete `%ProgramData%\AICFO` manually or via custom action (not implemented). |
| **Credential Manager entries** | **No.** Must be removed by user or a custom action (not implemented). Recommendation: document that users may delete “AICFO_CONNECTOR_TOKEN_*” credentials after uninstall. |

---

## 9) Code signing status

| Item | Current state | Recommendation |
|------|----------------|----------------|
| **MSI** | Not signed in CI. | Sign with a valid code-signing certificate (standard or EV). |
| **Binaries** (.exe, .dll) | Not signed in CI. | Sign all shipped executables and key DLLs. |
| **CI/CD (GitHub Actions)** | Build produces unsigned MSI. | Add step to sign binaries then MSI (e.g. `signtool.exe` or Azure Sign Tool). Store cert in GitHub Secrets or use OIDC with Azure Key Vault. |
| **Local signing** | N/A. | Use same `signtool` (or equivalent) with your cert; sign after build, then optionally run smoke tests. |

**Steps to add signing (outline):**

1. **Obtain certificate:** EV or standard code-signing cert from a public CA (e.g. DigiCert, Sectigo). EV reduces SmartScreen warnings faster.
2. **Install signtool:** Part of Windows SDK (e.g. `C:\Program Files (x86)\Windows Kits\10\bin\<arch>\signtool.exe`).
3. **Sign binaries (local):**  
   `signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /f MyCert.pfx /p <password> connector-dotnet\publish\service\AICFO.Connector.Service.exe` (repeat for tray and other binaries).
4. **Sign MSI:** After building MSI:  
   `signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /f MyCert.pfx /p <password> connector-dotnet\installer\bin\Release\AICFOConnectorSetup.msi`
5. **In GitHub Actions:** Export cert (base64) and password as secrets; decode cert to a PFX in the runner; run the same signtool commands in the workflow after build, then upload the signed MSI artifact.

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
- [ ] **Uninstall:** Service and Run key removed; ProgramData and credentials documented (done).
- [ ] **Code signing:** Sign all binaries and MSI before release (steps above).
- [ ] **Permissions:** Document LocalSystem and admin install (done in this doc).
- [ ] **Node.js connector:** If shipping, avoid storing production tokens in config; document secure configuration.

---

*Document version: 1.0. Last updated with connector-dotnet and WiX as of this review.*
