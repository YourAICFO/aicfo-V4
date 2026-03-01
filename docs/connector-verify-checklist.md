# Connector: How to verify (online status, unlink, readiness)

Use this checklist after deploying connector/backend/frontend changes.

**Before deploy:** Run backend migrations so `data_sync_status` has `updated_at` (migration `2026-03-01-data-sync-status-timestamps.sql`). This fixes "column updated at does not exist" in status/v1.

## 1. Heartbeat and online status

1. Start the connector (tray or service) and ensure it is linked to a company (mapping present).
2. Wait at least 30 seconds for a heartbeat to be sent.
3. In the web app, open the company and go to Connector Setup (or the page that shows connector status).
4. Click **Check Connection** (or refresh the page).
5. **Verify:** "Connector Connected (Online)" appears, **Last seen** shows a recent time, and Connector Diagnostics shows `lastSeenAt` populated and `isOnline: Yes`.

Optional: call the API directly:
- `GET /api/connector/status/v1?companyId=<uuid>` with user Bearer token.
- Response `data.connector.lastSeenAt` should be a recent ISO timestamp and `data.connector.isOnline` should be `true`.

## 2. Readiness after sync

1. With the connector running and linked, trigger a full sync (from tray or API).
2. Wait for sync to complete (sync/complete returns 200).
3. Refresh connector status in the web app (or call `GET /api/connector/status/v1?companyId=...`).
4. **Verify:** "No snapshot data available" does **not** appear after a successful sync; Data Readiness shows a status (e.g. "ready" or "processing"). Connector Diagnostics shows `snapshotLatestMonthKey`, `snapshotLedgersCount`, and `ledgerBalancesStoredCount` (non-zero after sync).

## 3. Unlink from web

1. With at least one active link for the company, open Connector Setup in the web app.
2. In **Linked Tally companies**, click **Unlink** for one link.
3. Confirm in the dialog (irreversible warning).
4. **Verify:** The link disappears from the list; if no links remain, the UI shows "Not linked" / "Not connected" as appropriate.
5. **Verify:** A subsequent `GET /api/connector/status/v1?companyId=...` returns `data.links` without the unlinked link.

## 4. Self-diagnostics

1. On the Connector Setup page, open **Connector Diagnostics**.
2. **Verify:** lastSeenAt, isOnline, device name, lastRunId, lastSyncAt, readiness, and (if available) snapshot month/ledger count are shown.
3. Click **Copy diagnostics**.
4. **Verify:** Pasting into a text editor yields valid JSON with connector status and no secrets.

## 5. Backend tests (optional)

From repo root:

```bash
cd backend
DATABASE_URL=postgres://... node --test test/connectorHeartbeatUnlink.test.js
```

- Heartbeat test: updating `ConnectorDevice` by `deviceId` updates `lastSeenAt`.
- Unlink test: setting a link’s `isActive` to false excludes it from active links for status.
- Snapshot test: after creating LedgerMonthlyBalance rows, count for company is > 0 (status/v1 ledgerBalancesStoredCount source).

---

## Production verification (5 steps)

1. Run migrations: node src/db/migrate.js (or your deploy pipeline) so data_sync_status.updated_at exists.
2. Heartbeat: Start connector, wait ~30s, call GET /api/connector/status/v1?companyId=id with user JWT; confirm data.connector.lastSeenAt is set and data.connector.isOnline is true.
3. Sync: Trigger full sync; after completion call status/v1 again; confirm data.ledgerBalancesStoredCount > 0 and data.dataReadiness.status is processing or ready.
4. No column error: Open connector status in the UI; confirm no "column updated at does not exist" in network/console.
5. Unlink: Use Unlink in the web app for a link; confirm link is removed and status/v1 no longer lists it.
