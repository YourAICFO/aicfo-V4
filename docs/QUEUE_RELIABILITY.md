# Queue Reliability

## Current Queue Topology

| Property | Value |
|----------|-------|
| Queue library | BullMQ |
| Queue name | `ai-cfo-jobs` (configurable via `WORKER_QUEUE_NAME`) |
| Default attempts | 5 |
| Backoff | Exponential, 1 s base |
| `removeOnComplete` | 1000 (BullMQ keeps last 1000 in Redis) |
| `removeOnFail` | 1000 (BullMQ keeps last 1000 in Redis) |
| Concurrency | 4 (configurable via `WORKER_CONCURRENCY`) |
| Resilient mode | `QUEUE_RESILIENT_MODE=true` → synchronous processing without Redis |

### Job Types

| Job name | Critical | Idempotency-guarded |
|----------|----------|---------------------|
| `generateMonthlySnapshots` | **Yes** | `monthly_snapshot` |
| `updateReports` | **Yes** | `monthly_report` |
| `batchRecalc` | **Yes** | `batch_recalc` |
| `generateAIInsights` | Medium | `ai_insights` |
| `sendNotifications` | Low | No |
| `healthPing` | Diagnostic | No |

## DLQ (Dead Letter Queue)

### What happens on failure

1. **Every attempt**: recorded to `job_failures` PostgreSQL table with `is_final_attempt=false`.
2. **Final attempt** (attempt 5 of 5): recorded with `is_final_attempt=true` and triggers spike check.
3. BullMQ also keeps the last 1000 failed jobs in Redis (`removeOnFail: 1000`).
4. The DB record is the durable truth — survives Redis restarts.

### Table schema: `job_failures`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `job_id` | TEXT | BullMQ job identifier |
| `job_name` | TEXT | Handler name |
| `queue_name` | TEXT | Default `ai-cfo-jobs` |
| `company_id` | UUID | From job payload (nullable) |
| `payload` | JSONB | Redacted job data |
| `attempts` | INT | Attempt number when failure occurred |
| `max_attempts` | INT | Total configured attempts |
| `is_final_attempt` | BOOL | True when all retries exhausted |
| `failed_reason` | TEXT | Error message (≤2000 chars) |
| `stack_trace` | TEXT | Stack trace (≤4000 chars) |
| `first_failed_at` | TIMESTAMPTZ | When failure occurred |
| `resolved_at` | TIMESTAMPTZ | Set when admin retries the job |

### Retention

- Default **14 days** (`JOB_DLQ_RETENTION_DAYS`).
- Auto-pruned every worker ticker cycle (hourly).
- Manual: `POST /api/admin/queue/prune`.

### Payload Redaction

Keys containing `password`, `token`, `secret`, `key`, or `authorization` are replaced with `[REDACTED]` before DB persistence and before returning in admin API responses.

## Idempotency Locks

### Scope Rules

| Job | `job_key` | `scope_key` format |
|-----|-----------|-------------------|
| `generateMonthlySnapshots` | `monthly_snapshot` | `<companyId>:<amendedMonth\|"full">` |
| `updateReports` | `monthly_report` | `<companyId>:<periodStart>_<periodEnd>` |
| `batchRecalc` | `batch_recalc` | `<companyId>:<periodStart>_<periodEnd>` |
| `generateAIInsights` | `ai_insights` | `<companyId>:<YYYY-MM-DD>` |

### Lock Semantics (DB-enforced)

```
UNIQUE (company_id, job_key, scope_key)
```

| Current state | Same payloadHash? | Action |
|---------------|-------------------|--------|
| No row exists | — | INSERT `running` → **proceed** |
| `running` + recent (< 30 min) | — | **skip** (`already_running`) |
| `running` + stale (> 30 min) | — | UPDATE → **take over** (crashed worker) |
| `completed` | Yes | **skip** (`already_completed`) |
| `completed` | No (data changed) | UPDATE → **re-run** |
| `failed` | — | UPDATE → **retry** |

### Payload Hash

A deterministic SHA-256 hash (truncated to 16 hex chars) of the job payload is stored alongside the lock. Sensitive keys are stripped before hashing so they don't influence dedup.

### Fail-open Design

If the lock system itself fails (DB error, constraint race), the job **proceeds anyway** to avoid false negatives blocking critical work.

## Admin Endpoints

All require `authenticate` + `requireAdmin`.

### GET /api/admin/queue/health

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/admin/queue/health
```

Response:
```json
{
  "success": true,
  "data": {
    "queueName": "ai-cfo-jobs",
    "resilientMode": false,
    "counts": { "waiting": 0, "active": 1, "delayed": 0, "failed": 2, "completed": 150 },
    "oldestWaitingAgeSec": null,
    "failedLastHour": 1,
    "topFailedJobs": [{ "jobName": "generateAIInsights", "count": 3 }],
    "dlq": { "failedLastHour": 1, "failedLast24h": 5, "retentionDays": 14 }
  }
}
```

### GET /api/admin/queue/failures?limit=50&companyId=...&jobName=...

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/admin/queue/failures?limit=10&jobName=generateMonthlySnapshots"
```

### POST /api/admin/queue/retry

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"failureId":"<uuid>"}' \
  http://localhost:5000/api/admin/queue/retry
```

### POST /api/admin/queue/prune

Triggers manual DLQ cleanup (entries older than retention).

## Alerting

When `job_failures` count in the last hour reaches `JOB_FAILURE_SPIKE_THRESHOLD` (default 10), a structured ERROR log is emitted:

```json
{ "type": "QUEUE_FAILURE_SPIKE", "failedLastHour": 12, "threshold": 10, "queueName": "ai-cfo-jobs" }
```

Checked on every final failure event and every worker ticker cycle.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JOB_DLQ_RETENTION_DAYS` | `14` | Days to keep DLQ entries |
| `JOB_FAILURE_SPIKE_THRESHOLD` | `10` | Failures/hour before alert |
| `JOB_LOCK_STALE_MINUTES` | `30` | Lock considered stale after N min |

## Smoke Checklist

```bash
# 1. Run migration
npm run db:migrate

# 2. Verify tables exist
psql $DATABASE_URL -c "SELECT count(*) FROM job_failures; SELECT count(*) FROM job_idempotency_locks;"

# 3. Run tests
node --test test/idempotencyService.test.js test/jobFailureService.test.js

# 4. Start backend and check health (requires admin auth)
npm run dev:backend
curl -H "Authorization: Bearer <admin-token>" http://localhost:5000/api/admin/queue/health
```
