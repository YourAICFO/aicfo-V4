# Layer 1 Closure — Block 3: Infra Safety Rails

## What Changed

### P1: Redis-backed Rate Limiting
- Replaced in-memory `express-rate-limit` store with `rate-limit-redis` when `REDIS_URL` is available.
- Falls back to in-memory store in dev or when Redis is unavailable.
- Applied per-group limiters to all previously unprotected route groups: `/api/jobs`, `/api/admin/*`, `/api/billing`.
- Configurable per-group limits via env vars.

### P2: Input Validation
- Created `middleware/validateBody.js` (zod-based `validateBody` + `validateQuery`).
- Applied to high-risk endpoints: `POST /api/ai/chat`, `POST /api/finance/pl-ai-explanation`, `POST /api/finance/alerts/snooze`.
- Returns `{ success:false, error:"INVALID_INPUT", details:[...] }` on validation failure.

### P3: Monitoring Hooks
- `middleware/errorSpikeMonitor.js`: rolling 60s 5xx counter in the API server, structured `API_5XX_SPIKE` log + Sentry alert on threshold.
- Worker: 5-minute queue failure spike monitor (`startQueueMonitor`), gated by `QUEUE_MONITORING_ENABLED`.

### P4: Admin Guard Audit
Fixed 3 admin endpoints that were missing `requireAdmin`:
- `GET  /api/admin/connector/devices`
- `POST /api/admin/connector/revoke`
- `GET  /api/admin/ingestion/health`

All 28 admin routes now enforce either `authenticate+requireAdmin` or `requireAdminApiKey`.

## Env Vars Added

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Master switch for rate limiting |
| `RATE_LIMIT_REDIS_ENABLED` | `true` | Use Redis store when REDIS_URL present |
| `RATE_LIMIT_AUTH_PER_MIN` | `20` | Auth endpoint limit |
| `RATE_LIMIT_AI_PER_MIN` | `30` | AI endpoint limit |
| `RATE_LIMIT_ADMIN_PER_MIN` | `60` | Admin endpoint limit |
| `RATE_LIMIT_CONNECTOR_PER_MIN` | `30` | Connector endpoint limit |
| `RATE_LIMIT_BILLING_PER_MIN` | `20` | Billing endpoint limit |
| `RATE_LIMIT_JOBS_PER_MIN` | `30` | Jobs endpoint limit |
| `RATE_LIMIT_GLOBAL_PER_MIN` | `300` | Global fallback limit |
| `API_5XX_SPIKE_THRESHOLD` | `20` | 5xx errors in 60s before alert |
| `QUEUE_FAIL_SPIKE_THRESHOLD` | `10` | Queue failures in 60min before alert |
| `QUEUE_MONITORING_ENABLED` | `true` | Enable worker queue monitoring timer |

## Rate-Limited Route Groups

| Route prefix | Limiter | Per-min default |
|-------------|---------|-----------------|
| `/api/auth` | authLimiter | 20 (POST only) |
| `/api/ai` | aiLimiter | 30 |
| `/api/connector` | connectorLimiter | 30 |
| `/api/billing` | billingLimiter | 20 |
| `/api/admin/*` | adminLimiter | 60 |
| `/api/jobs` | jobsLimiter | 30 |

## Validated Endpoints

| Endpoint | Schema |
|----------|--------|
| `POST /api/auth/register` | express-validator: email, password(8+), names |
| `POST /api/auth/login` | express-validator: email, password |
| `POST /api/ai/chat` | zod: `{ message: string(1..4000), threadId?: uuid }` |
| `POST /api/connector/device/login` | zod: `{ email: email, password: string, deviceId?: string, deviceName?: string }` |
| `POST /api/finance/pl-ai-explanation` | zod: `{ month: YYYY-MM, forceRegenerate?: bool }` |
| `POST /api/finance/alerts/snooze` | zod: `{ ruleKey: string, days: 7\|30 }` |
| `POST /api/finance/alerts/dismiss` | zod: `{ ruleKey: string }` |
| `POST /api/finance/alerts/clear` | zod: `{ ruleKey: string }` |
| `POST /api/admin/queue/retry` | zod: `{ failureId: uuid }` |
| `POST /api/companies` | express-validator: name, industry, currency |

## Smoke Checklist (Railway)

1. Deploy → verify `/health` returns ok
2. Set `ALLOWED_ORIGINS` and `REDIS_URL` env vars on Railway
3. Verify rate limiting: hit `/api/auth/login` 21 times in 60s → expect 429
4. Verify validation: `POST /api/ai/chat` with empty body → expect 400 INVALID_INPUT
5. Verify admin guard: non-admin user hits `/api/admin/connector/devices` → expect 403
6. Monitor logs for `API_5XX_SPIKE` and `QUEUE_FAILURE_SPIKE` structured events
