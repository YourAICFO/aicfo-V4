# Queue Reliability

## Overview

The AI CFO platform uses BullMQ (Redis-backed) for async job processing.
In development, `QUEUE_RESILIENT_MODE=true` processes jobs synchronously
without Redis.

## DLQ (Dead Letter Queue)

### Behavior

When a job exhausts all retries (default 5, exponential backoff from 1s),
it is persisted to the `job_failures` PostgreSQL table with:

| Column | Description |
|--------|-------------|
| `job_id` | BullMQ job identifier |
| `job_name` | Handler name (e.g. `generateMonthlySnapshots`) |
| `queue_name` | Queue name (default `ai-cfo-jobs`) |
| `company_id` | Associated company, if present in payload |
| `payload` | Job data (sensitive fields redacted) |
| `attempts` | Total attempts made |
| `failed_reason` | Error message (truncated to 2000 chars) |
| `stack_trace` | Stack trace (truncated to 4000 chars) |
| `first_failed_at` | Timestamp of first failure |
| `resolved_at` | Set when admin retries the job |

### Retention

- Default: 30 days (`JOB_DLQ_RETENTION_DAYS` env var).
- Auto-pruned on each worker ticker cycle (hourly by default).
- Manual prune: `POST /api/admin/queue/prune`.

### Payload Redaction

Before persisting, payloads are scanned for sensitive keys (password,
token, secret, key, authorization) and replaced with `[REDACTED]`.

## Idempotency Locks

### Behavior

Critical jobs are wrapped with idempotency guards using the
`job_idempotency_locks` table with a unique constraint on
`(company_id, job_key, scope_key)`.

### Protected Jobs

| Job | job_key | scope_key |
|-----|---------|-----------|
| `generateMonthlySnapshots` | `monthly_snapshot` | `amendedMonth` or `"full"` |
| `generateAIInsights` | `ai_insights` | current date (YYYY-MM-DD) |
| `updateReports` | `update_reports` | `{periodStart}_{periodEnd}` |

### Lock Semantics

1. **First call**: INSERT lock row with `status=running` → proceed.
2. **Duplicate while running**: If `status=running` and `locked_at` is
   recent (within `JOB_LOCK_STALE_MINUTES`, default 30) → **skip**.
3. **Stale running lock**: If `status=running` but older than threshold →
   **take over** (previous worker likely crashed).
4. **Completed**: If `status=completed` → **skip** (already done).
5. **Failed**: If `status=failed` → **allow retry** (re-acquire lock).

### Race Safety

- Unique constraint prevents duplicate INSERT at DB level.
- `SequelizeUniqueConstraintError` caught and treated as "skip".
- On failure to acquire for any reason, the job proceeds anyway to
  prevent false negatives from blocking work.

## Admin Endpoints

All require `authenticate` + `requireAdmin`.

### GET /api/admin/queue/health

Returns queue status and DLQ stats.

```json
{
  "success": true,
  "data": {
    "queueName": "ai-cfo-jobs",
    "resilientMode": false,
    "counts": { "waiting": 0, "active": 0, "delayed": 0, "failed": 0, "completed": 12 },
    "oldestWaitingAgeSec": null,
    "dlq": { "failedLastHour": 0, "failedLast24h": 2, "retentionDays": 30 }
  }
}
```

### GET /api/admin/queue/failed?limit=50&offset=0

Returns paginated DLQ entries.

### POST /api/admin/queue/retry

Re-enqueues a failed job. Body: `{ "failureId": "<uuid>" }`.
Marks the DLQ entry as resolved.

### POST /api/admin/queue/prune

Manually triggers DLQ retention cleanup.

## Alerting

### Failure Spike Detection

When the number of DLQ entries in the last hour reaches the threshold
(default `JOB_FAILURE_SPIKE_THRESHOLD=10`), a structured ERROR log is
emitted:

```json
{
  "type": "QUEUE_FAILURE_SPIKE",
  "failedLastHour": 12,
  "threshold": 10,
  "queueName": "ai-cfo-jobs"
}
```

This is checked:
- On every final job failure (after retries exhausted).
- On each worker ticker cycle (hourly).

Wire this to Sentry, Datadog, or PagerDuty by matching on `type: "QUEUE_FAILURE_SPIKE"`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JOB_DLQ_RETENTION_DAYS` | `30` | Days to keep DLQ entries |
| `JOB_FAILURE_SPIKE_THRESHOLD` | `10` | Failures/hour before alert |
| `JOB_LOCK_STALE_MINUTES` | `30` | Lock considered stale after N minutes |

## Smoke Checklist

1. Run migration: `npm run db:migrate`
2. Verify tables: `SELECT count(*) FROM job_failures; SELECT count(*) FROM job_idempotency_locks;`
3. Start backend: `npm run dev:backend`
4. Health endpoint: `curl http://localhost:5000/api/admin/queue/health` (requires admin auth)
5. Tests: `node --test test/idempotencyService.test.js test/jobFailureService.test.js`
