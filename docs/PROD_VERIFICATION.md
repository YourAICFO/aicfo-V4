# Production Verification

## Quick Check

```bash
# Without auth (core health only)
BASE_URL=https://your-app.railway.app ./backend/scripts/verify-prod.sh

# With admin auth (full suite)
BASE_URL=https://your-app.railway.app TOKEN=<admin-jwt> ./backend/scripts/verify-prod.sh
```

## Manual curl Commands

### Core Health
```bash
curl -sf https://your-app.railway.app/health
# Expected: {"status":"ok","timestamp":"...","environment":"production"}
```

### Metrics (Prometheus)
```bash
curl -sf https://your-app.railway.app/metrics
# Expected: text/plain with http_requests_total, dlq_count, etc.
```

### Auth (negative test)
```bash
curl -s https://your-app.railway.app/api/auth/me
# Expected: 401 {"error":"Access denied. No token provided."}
```

### Admin Queue Health (requires admin JWT)
```bash
curl -sf https://your-app.railway.app/api/admin/queue/health \
  -H "Authorization: Bearer <token>"
# Expected: 200 with counts, failedLastHour, topFailedJobs, lastWorkerHeartbeatAgeSec
```

### Dashboard Overview (requires auth + company)
```bash
curl -sf https://your-app.railway.app/api/dashboard/overview \
  -H "Authorization: Bearer <token>"
# Expected: 200 with CFO overview data
```

## What the Script Checks

| Check | Endpoint | Expected |
|-------|----------|----------|
| Health | `GET /health` | 200, body contains `"status":"ok"` |
| Metrics | `GET /metrics` | 200, contains `http_requests_total` and `dlq_count` |
| Auth guard | `GET /api/auth/me` | 401 (no token) |
| Queue health | `GET /api/admin/queue/health` | 200, has `queueName` + `failedLastHour` |
| Dashboard | `GET /api/dashboard/overview` | 200 (authed) |

## Getting an Admin JWT

```bash
curl -s -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin-email>","password":"<password>"}' \
  | jq -r '.data.token'
```

The email must be in the `ADMIN_EMAILS` env var on Railway.
