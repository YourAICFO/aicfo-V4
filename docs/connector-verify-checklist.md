# Connector: How to verify (online status, unlink, readiness)

Use this checklist after deploying connector/backend/frontend changes.

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
4. **Verify:** "No snapshot data available" does **not** appear after a successful sync; Data Readiness shows a status (e.g. "ready" or latest month). Connector Diagnostics may show `snapshotLatestMonthKey` and `snapshotLedgersCount`.

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
