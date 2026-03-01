# Release notes

## 1.0.2

**Connector (Windows)**

- **Fix: Web company selection persistence** — Selected web company is now saved to `config.json` (`selected_web_company_id`). On startup and after "Refresh companies", the dropdown restores the last selected company instead of always defaulting to the first. Changing the dropdown updates the stored selection and all downstream (link creation, sync target).
- **Fix: Selection logic** — Preferred company is resolved from current combo selection or, when empty (e.g. first load), from persisted `selected_web_company_id`. Testable helper `WebCompanySelectionHelper.GetPreferredCompanyIndex` with unit tests.
- No "download-from-company" coupling: connector does not read companyId from installer or discovery; selection is purely from login + companies API + user choice.

**Build:** Same as 1.0.1. CI: GitHub Actions `build-windows-connector-msi.yml` runs on push to main (validate + build-msi). To attach MSI + portable ZIP to a Release: create a release with tag e.g. `Connector-1.0.2`, then run the workflow with "workflow_dispatch" and optional `tag_name: Connector-1.0.2`, or publish the release (workflow runs on `release: published`).

---

## 1.0.1

**Build:** From repo root or `connector-dotnet`, run `.\build-release-local.ps1` (PowerShell). Produces `connector-dotnet/out/release/`: portable ZIP, SHA256 files, `release-manifest.json`, and MSI if WiX is installed. Do not commit `out/`, `bin/`, `obj/`, or `*.msi`.

---

**Connector (Windows)**

- **Fix: Tally company list detection** — Response is read as bytes and decoded (UTF-8 and UTF-16 BOM). Parser supports multiple Tally export tag names (COMPANYNAME, NAME, COMPANY, CMPNAME). HTML/license-page responses are detected and reported clearly. When zero companies are returned, the UI shows: "No companies returned by Tally. Open a company in Tally and retry." Diagnostics log status code, content-type, and response snippet when extraction yields zero.
- **Fix: Web company dropdown** — Dropdown shows **all** companies for the logged-in user and allows switching. No longer limited to "unlinked" companies. Backend already returns user-scoped companies; connector now displays all and logs count/names for diagnostics.

**Backend**

- **Fix: Connector device companies endpoint** — Regression test ensures `GET /api/connector/device/companies` returns all companies for the same owner (user-scoped list). Ordering uses DB column `created_at`. See `backend/test/connectorCompaniesEndpoint.test.js`.

---

## Production verification (after deploy)

```bash
# Health
curl -s -o /dev/null -w "%{http_code}" "https://YOUR_BACKEND_URL/health"
# Expect: 200

# Device companies (replace TOKEN and BASE_URL)
curl -s -w "\n%{http_code}" -H "Authorization: Bearer TOKEN" "https://YOUR_BACKEND_URL/api/connector/device/companies"
# Expect: 200 and JSON { "success": true, "data": [ { "id": "...", "name": "..." }, ... ] }
```

---

## Post-install checklist (Windows, connector 1.0.2)

Run after installing or upgrading to 1.0.2:

1. **Detect Tally** — Open Tally with at least one company. In the connector, ensure Tally host/port (e.g. 127.0.0.1:9000) and click **Detect Tally** or equivalent. Status should show "Detected (host:port, N companies)" or "Reachable (N companies)".
2. **Rescan Tally companies** — Click **Rescan Tally companies**. The Tally company dropdown should list the company(ies). If it shows "No companies returned by Tally...", open a company in Tally and retry.
3. **Login and refresh companies** — Log in with a user that has access to one or more web companies. Click **Refresh companies**. The Web Company dropdown should list **all** companies for that user.
4. **Switch company and sync** — Select a different web company from the dropdown (if you have more than one). Link a Tally company to it if needed, then run a sync. Confirm the sync target matches the selected web company.
