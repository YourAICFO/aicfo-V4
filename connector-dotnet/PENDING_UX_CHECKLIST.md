# Connector PENDING UX Checklist (Phase 0)

## Mapping tab – current state

| Item | Status |
|------|--------|
| Email/password login controls | ✅ Present |
| Web company dropdown | ✅ Present |
| Tally company dropdown | ✅ Present |
| Host + port fields | ⚠️ On **Status** tab only (global); not on Mapping tab |
| Mapping list grid/table | ✅ Present (_mappingsList) |
| Save (LINK) / Unlink buttons | ✅ Present |
| Refresh Status button | ✅ On Status tab |
| Copy Diagnostics button | ✅ On Status tab (per selected mapping) |

## Requirements A–F vs current code

| Id | Requirement | Status |
|----|-------------|--------|
| **A** | Linked Company **summary panel** with: Web company name + short ID, Tally company name, Auth method, Online, Last seen, Last sync (status + completed time), Readiness month/status, Last error; updates on mapping selection | ⚠️ **Partial** – Panel exists with 4 fields (Online, Last Heartbeat, Last Sync Status, Readiness Month). Missing: Web name + short ID, Tally name, Auth method, Last sync completed time, Last error. Must update when user selects a row. |
| **B** | Confirmation dialog with "You are linking Web Company: &lt;name&gt; (&lt;short id&gt;) to Tally Company: &lt;name&gt;" + warning label "Be careful: linking wrong company will sync wrong data." | ⚠️ **Partial** – Confirmation exists but without short ID. Warning text differs from spec. |
| **C** | Prevent duplicate/conflicting mappings (same web→two tally, same tally→two web); normalize Tally names; ignore self on edit | ✅ **Done** – GetMappingConflictMessage + NormalizeCompanyName; existing?.Id used to ignore self. |
| **D** | Status tab: Refresh Status + Copy Diagnostics. Mapping tab: Activity log (last 20 events) | ⚠️ **Partial** – Refresh + Copy Diagnostics ✅. Activity log ❌ (Phase 3). |
| **E** | Host textbox, Detect button, Test Tally button; save host/port to config | ✅ **Done** – _tallyHost, _tallyPort on Status tab; Detect Tally + Test Tally buttons; Save Settings persists. |
| **F** | Start at login: show On/Off from HKCU Run; Enable/Disable button | ✅ **Done** – _startWithWindowsToggle, _startWithWindowsStatus, AutoStartManager. |

## Phase 1 – DONE

- **Linked Company summary panel (A):** Expanded to show Web company name, Short ID, Tally company name, Auth method, Tally (Host:Port), Online, Last Seen, Last Sync (status + completed time), Readiness, Last Error. Updates when user selects a mapping row; shows "Select a mapping above" when none selected.
- **Confirmation (B):** Dialog text now includes short ID: "You are linking Web Company: &lt;name&gt; (&lt;short id&gt;) to Tally Company: &lt;name&gt;".
- **Warning label (B):** Text set to "Be careful: linking wrong company will sync wrong data."
- **Conflict prevention (C):** Already in place; no code change.

### Verification (Phase 1)

1. Open Control Panel → Company Mapping tab.
2. Select a mapping from the "Linked Companies" list → Linked Company Summary should show all fields for that mapping.
3. Clear selection (click away or select nothing) → Summary should show "Select a mapping above" and dashes.
4. Click LINK with a new pair → Confirmation should show web company name, short ID in parentheses, and Tally company name.
5. Try linking same web company to a second Tally company → Should see "This Web Company is already linked to Tally Company '...'. Unlink the old mapping first."

## Phase 2 – DONE

- **Detect Tally:** Uses host (default 127.0.0.1) and ports [9000, configured, 9001, 9002]; on success sets host/port and company list and shows "Detected (host:port, N companies)".
- **Test Tally:** Shows "Connected (N companies)" or "Unreachable" / "Reachable (company list failed)".

## Phase 3 – DONE (Option A: local)

- **Recent actions** list (last 20) on Mapping tab: Login OK, Saved mapping, Sync OK/Failed, Unlinked. No backend endpoint.

## Phase 4 – DONE

- Status tab label set to "Start at login:" with value "On" / "Off" (from HKCU Run). Toggle checkbox already enables/disables.

## Phase 5 – Verification

- Tray menu: "Open Connector Control Panel" opens Control Panel ✅
- Desktop/Start shortcuts: MSI (Package.wxs) – unchanged
- Tokens: Stored in Credential Manager only, not in config JSON ✅
- Errors: GetFriendlyLinkError and sanitized messages used ✅
