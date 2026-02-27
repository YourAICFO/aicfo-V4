# Layer 1 Closure — Block 4: Infra Operability

## What Changed

### P1: Migration Hardening
- Added `db:bootstrap` script (alias for `db:migrate` — bootstraps blank DB).
- Added `db:check` script (`--check` flag): verifies 14 critical table.column pairs.
- Documented in `docs/DB_BOOTSTRAP.md`.

### P2: CI Pipeline
- `backend-check`: npm ci → db:bootstrap → npm test → npm audit (non-blocking).
- `migration-sanity`: db:bootstrap → verify → db:check → /health smoke.
- `frontend-check`: npm ci → typecheck → build.
- npm audit runs with `continue-on-error: true`.

### P3: Observability
- Added `/metrics` endpoint (Prometheus text format).
- `metricsMiddleware`: counts requests by route group + status class, tracks duration.
- Includes: `queue_failures_last_hour`, `dlq_count`, `api_5xx_rolling_count`.
- Documented in `docs/OBSERVABILITY.md`.

### P4: Security Sweep
- All 28 admin routes confirmed guarded (authenticate+requireAdmin or requireAdminApiKey).
- Fixed `.gitignore`: added `**/.env` pattern to catch `frontend/.env` and `frontend/src/.env`.
- npm audit added to CI (non-blocking).

## New Scripts

| Script | Location | Description |
|--------|----------|-------------|
| `npm run db:bootstrap` | backend | Bootstrap DB from scratch (one command) |
| `npm run db:check` | backend | Verify critical table.column pairs exist |

## CI Pipeline Summary

| Job | Trigger | Steps |
|-----|---------|-------|
| `backend-check` | push + PR | npm ci → db:bootstrap → npm test → npm audit |
| `frontend-check` | push + PR | npm ci → typecheck → build |
| `migration-sanity` | push + PR | npm ci → db:bootstrap → verify → db:check → /health |

## Observability Endpoint

`GET /metrics` — no auth, Prometheus text format.

```
http_requests_total{route="/api/auth",status="2xx"} 42
http_requests_total{route="/api/ai",status="4xx"} 3
http_request_duration_ms{route="/api/auth",stat="avg"} 45
queue_failures_last_hour 0
dlq_count 0
api_5xx_rolling_count 0
```

## Smoke Checklist

```bash
# 1. Migration from scratch
npm run db:bootstrap    # should apply all migrations
npm run db:check        # should report 14/14 OK

# 2. Backend starts
npm run dev:backend
curl http://localhost:5000/health         # {"status":"ok"}
curl http://localhost:5000/metrics        # Prometheus format

# 3. Correlation ID
curl -v http://localhost:5000/health 2>&1 | grep x-run-id

# 4. Tests pass
cd backend && npm test                    # 135+ pass, 9 pre-existing fail

# 5. CI (push to branch)
git push                                  # triggers all 3 jobs
```
