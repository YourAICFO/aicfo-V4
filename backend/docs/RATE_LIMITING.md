# Rate limiting

Rate limiting is enforced per route group (auth, AI, connector, billing, admin, jobs) and globally. When **Redis** is enabled, limits are shared across all API instances (multi-instance safe).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Master switch; `false` disables all rate limiting. |
| `RATE_LIMIT_REDIS_ENABLED` | `true` | Use Redis store when `REDIS_URL` is set; otherwise in-memory. |
| `REDIS_URL` | — | **Required** when `RATE_LIMIT_REDIS_ENABLED=true` (except in `NODE_ENV=test`). |
| `RATE_LIMIT_AUTH_PER_MIN` | 20 | Login/auth attempts per IP per minute. |
| `RATE_LIMIT_AI_PER_MIN` | 30 | AI (chat/insights) requests per IP per minute. |
| `RATE_LIMIT_CONNECTOR_PER_MIN` | 30 | Connector API requests per IP per minute. |
| `RATE_LIMIT_BILLING_PER_MIN` | 20 | Billing/webhook requests per minute. |
| `RATE_LIMIT_ADMIN_PER_MIN` | 60 | Admin API requests per minute. |
| `RATE_LIMIT_JOBS_PER_MIN` | 30 | Job enqueue requests per minute. |
| `RATE_LIMIT_GLOBAL_PER_MIN` | 300 | Global requests per IP per minute. |

## Behaviour

- **Redis enabled** (`RATE_LIMIT_REDIS_ENABLED=true` and `REDIS_URL` set): limits are stored in Redis with per-limiter prefixes (`rl:auth:`, `rl:ai:`, etc.), so all instances share the same counters.
- **Redis disabled or unavailable**: each process uses in-memory limits (per-instance only). On Redis connection or store errors, the middleware **fails open** (allows the request) and logs a single warning; it does not crash or spam logs.

## Examples

### Development (single instance, no Redis)

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REDIS_ENABLED=false
# REDIS_URL not required
```

### Production (multi-instance, Redis)

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REDIS_ENABLED=true
REDIS_URL=redis://default:password@your-redis.railway.internal:6379
```

### Test / CI

In `NODE_ENV=test`, `REDIS_URL` is optional even when `RATE_LIMIT_REDIS_ENABLED=true`; the app uses in-memory limits if Redis is not configured.

## Verification

- **429** is returned when a limit is exceeded (e.g. many `POST /api/auth/login` requests in one minute).
- Optional: run `./scripts/verify-prod.sh` with `TOKEN` set to include a rate-limit check (repeated requests until 429).
