# Observability

## Metrics Endpoint

`GET /metrics` — Prometheus text format, no auth required.

### Available metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | counter | `route`, `status` | Total requests by route group + status class (2xx/4xx/5xx) |
| `http_request_duration_ms` | summary | `route`, `stat` | Duration stats: avg, max, count per route group |
| `queue_failures_last_hour` | gauge | — | DLQ entries created in last 60 min |
| `dlq_count` | gauge | — | Unresolved DLQ entries |
| `api_5xx_rolling_count` | gauge | — | 5xx errors in last 60s window |

### Route groups

Requests are bucketed by the second path segment:
`/api/auth/*` → `/api/auth`, `/api/ai/*` → `/api/ai`, etc.

### Scraping

```yaml
# prometheus.yml
scrape_configs:
  - job_name: aicfo
    metrics_path: /metrics
    static_configs:
      - targets: ['localhost:5000']
```

## Request Correlation

Every request gets a UUID `run_id`:
- Set by `middleware/requestContext.js`
- Attached to pino logs as `run_id`
- Returned in `x-run-id` response header
- Passed to Sentry context

Worker jobs use `run_id` format: `job-<bullmq_id>` or `sync-<timestamp>`.

## Sentry Integration

- Initialized in `utils/sentry.js` when `SENTRY_DSN` is set.
- Safe when missing (no crashes).
- Captures:
  - All unhandled Express errors (via `sentryErrorHandler`)
  - Worker job failures (via `captureException`)
  - `API_5XX_SPIKE` events (via `captureMessage` in errorSpikeMonitor)
  - `QUEUE_FAILURE_SPIKE` events (via `captureMessage` in jobFailureService)

## Structured Log Events

| Event type | Source | When |
|-----------|--------|------|
| `API_5XX_SPIKE` | API server | ≥20 5xx errors in 60s |
| `QUEUE_FAILURE_SPIKE` | Worker | ≥10 job failures in 60 min |
| `dlq_pruned` | Worker | Old DLQ entries cleaned up |
| `idempotency_skip_completed` | Worker | Job skipped (already done) |
| `idempotency_skip_running` | Worker | Job skipped (in progress) |

## Smoke Checklist

```bash
# Start backend
npm run dev:backend

# Check /metrics
curl http://localhost:5000/metrics

# Check correlation ID
curl -v http://localhost:5000/health 2>&1 | grep x-run-id

# Verify Sentry-safe when DSN missing
SENTRY_DSN="" npm run dev:backend   # should start without error
```
