# Observability and Diagnostics

## Migrations

- Run SQL migrations with:

```bash
npm run migrate
```

- This runs `backend/migrations/run-sql.js`.
- Each `.sql` file in `backend/migrations` is applied once and tracked in `schema_migrations`.
- Required environment variable:
  - `DATABASE_URL`

## Runtime Logging

- API and worker logs are structured JSON via `pino`.
- Each API request gets a `run_id` and `x-run-id` response header.
- Error and warning events are persisted to `app_logs` (best effort).

## Sentry

- Sentry is enabled only when `SENTRY_DSN` is set.
- `service`, `env`, and `git_sha` tags are attached.

## Recommended Run Order

1. Apply migrations:

```bash
npm run migrate
```

2. Start API:

```bash
npm run dev
```

3. Start worker (separate process):

```bash
npm run worker
```

## Doctor Command

- Generate one diagnostic report:

```bash
npm run doctor
```

- Output is printed and written to:
  - `/tmp/doctor_report.txt` (preferred)
  - fallback: `backend/doctor_report.txt`
