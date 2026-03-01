# Sync end-to-end verification (Windows + Railway)

## Why "Sync All" might show "pending" but not run

The Windows Service (AICFO Connector Service) runs as **LocalSystem** and reads config from `C:\ProgramData\AICFO\config\config.json`. Tokens are stored in Windows Credential Manager (machine) and in a **token file store** under `C:\ProgramData\AICFO\config\tokens\` (DPAPI LocalMachine) so the Service can read them. If the Service had no token, sync would never start.

## 1) Confirm the Service is running

- `services.msc` → find "AICFO Connector Service" → Status = Running.
- Or PowerShell: `Get-Service -Name "AICFO*"`.

## 2) Confirm pipe trigger is received

- Service log: **`C:\ProgramData\AICFO\logs\agent.log`**.
- After clicking "Sync Selected" or "Sync All", look for:
  - `[SYNC] Manual sync signal received mappingId=...`
  - `[SYNC] Config loaded path=... mappingsCount=N`
- If you see **`No token for mapping`** or **`No target mappings`**, fix config/token/link (see below).

## 3) Token and link

- After **device login** and **linking** in the Tray, click **Refresh companies** (or **Refresh links**). That saves the device token to both Credential Manager and the token file store, and updates each mapping’s **LinkId** from the backend.
- Ensure the mapping has a **LinkId**. If LinkId is missing, `POST /api/connector/sync/start` returns 400.

## 4) Backend (Railway)

- The connector sends `POST /api/connector/sync/start` with body `{ "linkId": "<link-id>", "at": "..." }` and header `Authorization: Bearer <device_token>`.
- Backend log (Railway): look for **`[connector] sync/start: creating run`** with `companyId`, `linkId`, `deviceId`.
- Sync payload is processed in the **web** process (`POST /api/connector/sync`). A BullMQ job `generateMonthlySnapshots` is enqueued after payload; ensure a **worker** service is running on Railway (separate service with **`RAILWAY_PROCESS=worker`**) so jobs are processed.

## 5) Verification checklist

- [ ] Service running; **agent.log** shows `[SYNC] Manual sync signal received` after clicking Sync.
- [ ] **agent.log** shows `[SYNC] Config loaded ... mappingsCount >= 1` and no `No token for mapping`.
- [ ] **agent.log** shows `[SYNC] Calling backend sync/start linkId=...` and `Backend sync/start returned runId=...`.
- [ ] Railway backend log shows `[connector] sync/start: creating run`.
- [ ] Tray status grid updates after sync (Last Sync, Last Error) or banner shows last error if sync did not complete.

## Run backend sync test

```bash
cd backend
npm test -- test/connectorSyncStart.test.js
```

(Skip when DATABASE_URL is not set.)
