-- DLQ: persistent record of jobs that exhausted all retries
CREATE TABLE IF NOT EXISTS job_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  queue_name TEXT NOT NULL DEFAULT 'ai-cfo-jobs',
  company_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  failed_reason TEXT,
  stack_trace TEXT,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_failures_job_name_idx ON job_failures(job_name);
CREATE INDEX IF NOT EXISTS job_failures_company_id_idx ON job_failures(company_id);
CREATE INDEX IF NOT EXISTS job_failures_created_at_idx ON job_failures(created_at);

-- Idempotency locks for critical jobs
CREATE TABLE IF NOT EXISTS job_idempotency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  job_key TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_job_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_idempotency_locks_unique_idx
  ON job_idempotency_locks(company_id, job_key, scope_key);
